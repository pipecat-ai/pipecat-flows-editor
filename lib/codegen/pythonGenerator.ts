import type {
  FlowJson,
  FlowNodeJson,
  FlowFunctionJson,
  MessageJson,
} from "@/lib/schema/flow.schema";

function escapePythonString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function generateTypeName(funcName: string): string {
  // Convert snake_case to PascalCase
  return (
    funcName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") + "Result"
  );
}

function generateTypeDefinition(func: FlowFunctionJson): string {
  const typeName = generateTypeName(func.name);
  const props = func.properties || {};

  if (Object.keys(props).length === 0) {
    // No properties, use base FlowResult
    return "";
  }

  const fields = Object.entries(props).map(([key, prop]: [string, any]) => {
    const pyType =
      prop.type === "integer"
        ? "int"
        : prop.type === "number"
          ? "float"
          : prop.type === "boolean"
            ? "bool"
            : "str";
    const optional = func.required?.includes(key) ? "" : " | None";
    return `    ${key}: ${pyType}${optional}`;
  });

  return `class ${typeName}(FlowResult):
    """Result type for ${func.name} function"""
${fields.join("\n")}
`;
}

function formatMessage(msg: MessageJson): string {
  // Use triple quotes for multiline content, regular quotes for single line
  const contentLines = msg.content.split("\n");
  const hasNewlines = contentLines.length > 1;
  const contentStr = hasNewlines
    ? `"""${msg.content.replace(/"""/g, '\\"\\"\\"')}"""`
    : JSON.stringify(msg.content);
  return `            {\n                "role": "${msg.role}",\n                "content": ${contentStr}\n            }`;
}

function formatProperty(prop: any, indent: string = "            "): string {
  const parts: string[] = [];
  if (prop.type) parts.push(`"type": "${prop.type}"`);
  if (prop.description) parts.push(`"description": "${escapePythonString(prop.description)}"`);
  if (prop.enum) parts.push(`"enum": ${JSON.stringify(prop.enum)}`);
  if (prop.minimum !== undefined) parts.push(`"minimum": ${prop.minimum}`);
  if (prop.maximum !== undefined) parts.push(`"maximum": ${prop.maximum}`);
  return `{\n${indent}    ${parts.join(`,\n${indent}    `)}\n${indent}}`;
}

function generateFunction(func: FlowFunctionJson): {
  handler: string;
  schema: string;
  typeDef?: string;
} {
  const funcName = func.name;
  const handlerName = `handle_${funcName}`;
  const props = func.properties || {};
  const required = func.required || [];
  const typeName = generateTypeName(funcName);
  const hasType = Object.keys(props).length > 0;

  // FlowsFunctionSchema requires properties and required to always be set
  let propertiesBlock = "";
  if (Object.keys(props).length > 0) {
    const propLines = Object.entries(props).map(([key, prop]: [string, any]) => {
      return `            "${key}": ${formatProperty(prop, "            ")}`;
    });
    propertiesBlock = `,\n        properties={\n${propLines.join(",\n")}\n        }`;
  } else {
    propertiesBlock = ",\n        properties={}";
  }

  const requiredBlock = `,\n        required=${JSON.stringify(required)}`;

  // Generate typed argument extraction
  const argExtraction =
    Object.keys(props).length > 0
      ? Object.entries(props)
          .map(([key, prop]: [string, any]) => {
            const pyType =
              prop.type === "integer"
                ? "int"
                : prop.type === "number"
                  ? "float"
                  : prop.type === "boolean"
                    ? "bool"
                    : "str";
            const defaultValue =
              prop.type === "integer" || prop.type === "number"
                ? "0"
                : prop.type === "boolean"
                  ? "False"
                  : '""';
            return `        ${key}: ${pyType} = args.get("${key}", ${defaultValue})`;
          })
          .join("\n") + "\n"
      : "";

  let nextNodeRouting: string;

  if (!hasType) {
    // No properties, return None
    if (func.next_node_id) {
      nextNodeRouting = `        return None, create_${func.next_node_id}_node()`;
    } else {
      nextNodeRouting = "        return None, None";
    }
  } else {
    // Has properties, use named parameters
    const namedParams = Object.keys(props)
      .map((key) => `${key}=${key}`)
      .join(", ");
    if (func.next_node_id) {
      nextNodeRouting = `        return ${typeName}(${namedParams}), create_${func.next_node_id}_node()`;
    } else {
      nextNodeRouting = `        return ${typeName}(${namedParams}), None`;
    }
  }

  // Generate return type annotation
  // If no type, return type is just None (not None | None)
  const firstType = hasType ? `${typeName} | None` : "None";
  const returnTypeAnnotation = func.next_node_id
    ? `tuple[${firstType}, NodeConfig]`
    : `tuple[${firstType}, NodeConfig | None]`;

  const handlerCode = `
    async def ${handlerName}(args: FlowArgs, flow_manager: FlowManager) -> ${returnTypeAnnotation}:
        """Handler for ${funcName} function"""
${argExtraction}        # TODO: Implement function logic
        # Update flow_manager.state as needed
${nextNodeRouting}
`;

  const schemaCode = `    ${funcName}_func = FlowsFunctionSchema(
        name="${funcName}",
        handler=${handlerName},
        description="${escapePythonString(func.description)}"${propertiesBlock}${requiredBlock}
    )`;

  const typeDefCode = hasType ? generateTypeDefinition(func) : undefined;

  return {
    handler: handlerCode,
    schema: schemaCode,
    typeDef: typeDefCode,
  };
}

function generateNodeFunction(node: FlowNodeJson): { nodeCode: string; typeDefs: string[] } {
  const nodeId = node.id;
  const data = node.data || {};

  const roleMessages = (data.role_messages as MessageJson[] | undefined) || [];
  const taskMessages = (data.task_messages as MessageJson[] | undefined) || [];
  const functions = (data.functions as FlowFunctionJson[] | undefined) || [];
  const preActions = (data.pre_actions || []) as any[];
  const postActions = (data.post_actions || []) as any[];
  const contextStrategy = data.context_strategy as
    | { strategy: "APPEND" | "RESET" | "RESET_WITH_SUMMARY"; summary_prompt?: string }
    | undefined;

  let code = `def create_${nodeId}_node() -> NodeConfig:
    """Create the ${data.label || nodeId} node."""
`;

  // Generate function handlers and collect type definitions
  const functionHandlers: string[] = [];
  const functionSchemas: string[] = [];
  const functionRefs: string[] = [];
  const typeDefs: string[] = [];

  functions.forEach((func) => {
    const funcGen = generateFunction(func);
    if (funcGen.typeDef) {
      typeDefs.push(funcGen.typeDef);
    }
    functionHandlers.push(funcGen.handler);
    functionSchemas.push(funcGen.schema);
    functionRefs.push(`${func.name}_func`);
  });

  if (functionHandlers.length > 0) {
    code += functionHandlers.join("\n");
    code += "\n";
    code += functionSchemas.join("\n");
    code += "\n";
  }

  code += `    return NodeConfig(
        name="${nodeId}",\n`;

  if (roleMessages.length > 0) {
    code += `        role_messages=[\n${roleMessages.map(formatMessage).join(",\n")}\n        ],\n`;
  }

  if (taskMessages.length > 0) {
    code += `        task_messages=[\n${taskMessages.map(formatMessage).join(",\n")}\n        ],\n`;
  }

  if (functions.length > 0) {
    code += `        functions=[${functionRefs.join(", ")}],\n`;
  }

  if (preActions.length > 0) {
    const actionStrs = preActions.map((action) => {
      if (action.type === "end_conversation") {
        return `            {"type": "end_conversation"}`;
      } else if (action.type === "function" && action.handler) {
        return `            {"type": "function", "handler": ${action.handler}}`;
      } else if (action.type === "tts_say" && action.text) {
        return `            {"type": "tts_say", "text": "${escapePythonString(action.text)}"}`;
      }
      return `            {"type": "${action.type}"}`;
    });
    code += `        pre_actions=[\n${actionStrs.join(",\n")}\n        ],\n`;
  }

  if (postActions.length > 0) {
    const actionStrs = postActions.map((action) => {
      if (action.type === "end_conversation") {
        return `            {"type": "end_conversation"}`;
      } else if (action.type === "function" && action.handler) {
        return `            {"type": "function", "handler": ${action.handler}}`;
      } else if (action.type === "tts_say" && action.text) {
        return `            {"type": "tts_say", "text": "${escapePythonString(action.text)}"}`;
      }
      return `            {"type": "${action.type}"}`;
    });
    code += `        post_actions=[\n${actionStrs.join(",\n")}\n        ],\n`;
  }

  if (contextStrategy && contextStrategy.strategy !== "APPEND") {
    if (contextStrategy.strategy === "RESET_WITH_SUMMARY") {
      const summaryPrompt = contextStrategy.summary_prompt
        ? escapePythonString(contextStrategy.summary_prompt)
        : "";
      code += `        context_strategy=ContextStrategyConfig(\n            strategy=ContextStrategy.${contextStrategy.strategy},\n            summary_prompt="${summaryPrompt}"\n        ),\n`;
    } else {
      code += `        context_strategy=ContextStrategyConfig(\n            strategy=ContextStrategy.${contextStrategy.strategy}\n        ),\n`;
    }
  }

  // Only include respond_immediately if it's False (True is the default)
  const respondImmediately = data.respond_immediately !== false;
  if (!respondImmediately) {
    code += `        respond_immediately=False,\n`;
  }

  code += `    )`;

  return { nodeCode: code, typeDefs };
}

function generateGlobalFunctions(flow: FlowJson): string {
  const globalFuncs = flow.global_functions || [];
  if (globalFuncs.length === 0) return "";

  let code = "\n# Global functions\n";
  globalFuncs.forEach((func) => {
    const props = func.properties || {};
    const required = func.required || [];
    const hasType = Object.keys(props).length > 0;
    const typeName = hasType ? generateTypeName(func.name) : "FlowResult";
    const handlerName = `handle_${func.name}`;

    // FlowsFunctionSchema requires properties and required to always be set
    let propertiesBlock = "";
    if (Object.keys(props).length > 0) {
      const propLines = Object.entries(props).map(([key, prop]: [string, any]) => {
        return `            "${key}": ${formatProperty(prop, "            ")}`;
      });
      propertiesBlock = `,\n        properties={\n${propLines.join(",\n")}\n        }`;
    } else {
      propertiesBlock = ",\n        properties={}";
    }

    const requiredBlock = `,\n        required=${JSON.stringify(required)}`;

    const argExtraction =
      Object.keys(props).length > 0
        ? Object.entries(props)
            .map(([key, prop]: [string, any]) => {
              const pyType =
                prop.type === "integer"
                  ? "int"
                  : prop.type === "number"
                    ? "float"
                    : prop.type === "boolean"
                      ? "bool"
                      : "str";
              const defaultValue =
                prop.type === "integer" || prop.type === "number"
                  ? "0"
                  : prop.type === "boolean"
                    ? "False"
                    : '""';
              return `        ${key}: ${pyType} = args.get("${key}", ${defaultValue})`;
            })
            .join("\n") + "\n"
        : "";

    // Generate result creation with named parameters
    let resultReturn: string;
    let returnTypeAnnotation: string;
    if (!hasType) {
      resultReturn = "        return None, None";
      returnTypeAnnotation = "tuple[None, None]";
    } else {
      const namedParams = Object.keys(props)
        .map((key) => `${key}=${key}`)
        .join(", ");
      resultReturn = `        return ${typeName}(${namedParams}), None`;
      // For functions with types, return type can be the type or None
      returnTypeAnnotation = `tuple[${typeName} | None, None]`;
    }

    code += `async def ${handlerName}(args: FlowArgs, flow_manager: FlowManager) -> ${returnTypeAnnotation}:
    """Global function: ${func.name}"""
${argExtraction}    # TODO: Implement ${func.name}
${resultReturn}

${func.name}_func = FlowsFunctionSchema(
    name="${func.name}",
    handler=${handlerName},
    description="${escapePythonString(func.description)}"${propertiesBlock}${requiredBlock}
)

`;
  });

  return code;
}

export function generatePythonCode(flow: FlowJson): string {
  // Check if any node uses context_strategy
  const hasContextStrategy = flow.nodes.some(
    (node) => node.data?.context_strategy && node.data.context_strategy.strategy !== "APPEND"
  );

  const nodes = flow.nodes || [];
  const initialNode = nodes.find((n) => n.type === "initial");
  const globalFuncs = flow.global_functions || [];

  // Collect all type definitions first
  const allTypeDefs = new Set<string>();
  const nodeFunctions: { nodeCode: string; typeDefs: string[] }[] = [];

  nodes.forEach((node) => {
    const funcGen = generateNodeFunction(node);
    funcGen.typeDefs.forEach((td) => allTypeDefs.add(td));
    nodeFunctions.push(funcGen);
  });

  // Generate global function types
  globalFuncs.forEach((func) => {
    const props = func.properties || {};
    if (Object.keys(props).length > 0) {
      allTypeDefs.add(generateTypeDefinition(func));
    }
  });

  const initialNodeId = initialNode?.id || "initial";
  const globalFuncRefs =
    globalFuncs.length > 0 ? globalFuncs.map((f) => `${f.name}_func`).join(", ") : "";

  let code = `"""Generated Pipecat Flow: ${flow.meta.name}

This file was generated from the visual flow editor.
Customize the function handlers to implement your flow logic.
"""

from pipecat_flows import (
    FlowArgs,
    FlowManager,
    FlowResult,
    FlowsFunctionSchema,
    NodeConfig${hasContextStrategy ? ",\n    ContextStrategy,\n    ContextStrategyConfig" : ""},
)

# Type definitions
${Array.from(allTypeDefs).join("\n")}

${generateGlobalFunctions(flow)}

# Node creation functions
`;

  // Generate all node functions
  nodeFunctions.forEach((funcGen) => {
    code += funcGen.nodeCode;
    code += "\n\n";
  });

  // Generate FlowManager initialization section (commented)
  code += `# FlowManager Setup
# 
# Initialize the FlowManager in your bot setup:
#
# async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
#     stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))
#     tts = CartesiaTTSService(api_key=os.getenv("CARTESIA_API_KEY"))
#     llm = create_llm()  # Your LLM service
#     
#     context = LLMContext()
#     context_aggregator = LLMContextAggregatorPair(context)
#     
#     pipeline = Pipeline([
#         transport.input(),
#         stt,
#         context_aggregator.user(),
#         llm,
#         tts,
#         transport.output(),
#         context_aggregator.assistant(),
#     ])
#     
#     task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))
#     
#     # Initialize FlowManager
#     flow_manager = FlowManager(
#         task=task,
#         llm=llm,
#         context_aggregator=context_aggregator,
#         transport=transport,
#         global_functions=[${globalFuncRefs}],
#     )
#     
#     @transport.event_handler("on_client_connected")
#     async def on_client_connected(transport, client):
#         logger.info("Client connected")
#         # Start the flow with the initial node
#         await flow_manager.initialize(create_${initialNodeId}_node())
`;

  return code;
}
