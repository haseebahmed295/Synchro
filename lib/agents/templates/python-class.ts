/**
 * Python class template
 * Generates Python class code from a diagram node
 */

export interface PythonClassTemplateVars {
  className: string;
  isAbstract?: boolean;
  isInterface?: boolean;
  attributes: Array<{ visibility: string; name: string; type: string }>;
  methods: Array<{ visibility: string; name: string; params: string; returnType: string }>;
  extendsClass?: string;
  framework?: string;
}

/**
 * Render a Python class from template variables
 */
export function renderPythonClass(vars: PythonClassTemplateVars): string {
  const { className, isAbstract, isInterface, attributes, methods, extendsClass, framework } = vars;

  const lines: string[] = [];

  // Imports
  if (isAbstract || isInterface) {
    lines.push("from abc import ABC, abstractmethod");
    lines.push("");
  }
  if (framework === "django") {
    lines.push("from django.db import models");
    lines.push("");
  } else if (framework === "fastapi") {
    lines.push("from pydantic import BaseModel");
    lines.push("");
  }

  // Class declaration
  const bases: string[] = [];
  if (extendsClass) bases.push(extendsClass);
  if (isAbstract || isInterface) bases.push("ABC");
  if (framework === "django") bases.push("models.Model");
  else if (framework === "fastapi") bases.push("BaseModel");

  const baseStr = bases.length > 0 ? `(${bases.join(", ")})` : "";
  lines.push(`class ${className}${baseStr}:`);

  // Docstring
  lines.push(`    """${className} class."""`);
  lines.push("");

  // __init__
  if (attributes.length > 0) {
    const initParams = attributes
      .map((a) => `${toSnakeCase(a.name)}: ${toPythonType(a.type)}`)
      .join(", ");
    lines.push(`    def __init__(self, ${initParams}) -> None:`);
    for (const attr of attributes) {
      const prefix = attr.visibility === "-" || attr.visibility === "private" ? "__" : attr.visibility === "#" || attr.visibility === "protected" ? "_" : "";
      lines.push(`        self.${prefix}${toSnakeCase(attr.name)} = ${toSnakeCase(attr.name)}`);
    }
    lines.push("");
  } else {
    lines.push("    pass");
    lines.push("");
  }

  // Methods
  for (const method of methods) {
    const prefix = method.visibility === "-" || method.visibility === "private" ? "__" : method.visibility === "#" || method.visibility === "protected" ? "_" : "";
    const abstractDecorator = (isAbstract || isInterface) ? "    @abstractmethod\n" : "";
    const returnType = toPythonType(method.returnType);
    const params = method.params ? `, ${method.params}` : "";
    lines.push(`${abstractDecorator}    def ${prefix}${toSnakeCase(method.name)}(self${params}) -> ${returnType}:`);
    if (isAbstract || isInterface) {
      lines.push("        ...");
    } else {
      lines.push("        # TODO: implement");
      lines.push("        raise NotImplementedError");
    }
    lines.push("");
  }

  return lines.join("\n");
}

function toSnakeCase(name: string): string {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

function toPythonType(tsType: string): string {
  const map: Record<string, string> = {
    string: "str",
    number: "float",
    boolean: "bool",
    void: "None",
    any: "Any",
    "string[]": "list[str]",
    "number[]": "list[float]",
  };
  return map[tsType] ?? tsType;
}
