/**
 * TypeScript class template
 * Generates TypeScript class code from a diagram node
 */

export interface TypeScriptClassTemplateVars {
  className: string;
  stereotype?: string;
  isAbstract?: boolean;
  isInterface?: boolean;
  attributes: Array<{ visibility: string; name: string; type: string }>;
  methods: Array<{ visibility: string; name: string; params: string; returnType: string }>;
  extendsClass?: string;
  implementsInterfaces?: string[];
  framework?: string;
}

/**
 * Render a TypeScript class from template variables
 */
export function renderTypeScriptClass(vars: TypeScriptClassTemplateVars): string {
  const { className, isAbstract, isInterface, attributes, methods, extendsClass, implementsInterfaces, framework } = vars;

  const lines: string[] = [];

  // Framework-specific imports
  if (framework === "nextjs") {
    lines.push(`import { NextRequest, NextResponse } from 'next/server';`);
    lines.push("");
  } else if (framework === "express") {
    lines.push(`import { Request, Response } from 'express';`);
    lines.push("");
  }

  // Class declaration
  const keyword = isInterface ? "interface" : isAbstract ? "abstract class" : "class";
  let declaration = `export ${keyword} ${className}`;

  if (!isInterface && extendsClass) {
    declaration += ` extends ${extendsClass}`;
  }
  if (implementsInterfaces && implementsInterfaces.length > 0) {
    const keyword2 = isInterface ? "extends" : "implements";
    declaration += ` ${keyword2} ${implementsInterfaces.join(", ")}`;
  }
  declaration += " {";
  lines.push(declaration);

  // Attributes (fields)
  if (attributes.length > 0) {
    for (const attr of attributes) {
      const tsVisibility = mapVisibility(attr.visibility);
      lines.push(`  ${tsVisibility} ${attr.name}: ${attr.type};`);
    }
    lines.push("");
  }

  // Constructor (only for classes, not interfaces)
  if (!isInterface && attributes.length > 0) {
    const ctorParams = attributes
      .filter((a) => a.visibility === "+" || a.visibility === "public")
      .map((a) => `${a.name}: ${a.type}`)
      .join(", ");
    lines.push(`  constructor(${ctorParams}) {`);
    for (const attr of attributes.filter((a) => a.visibility === "+" || a.visibility === "public")) {
      lines.push(`    this.${attr.name} = ${attr.name};`);
    }
    lines.push(`  }`);
    lines.push("");
  }

  // Methods
  for (const method of methods) {
    const tsVisibility = mapVisibility(method.visibility);
    const abstractKeyword = isAbstract && !isInterface ? "abstract " : "";
    const body = isInterface || (isAbstract && abstractKeyword) ? ";" : ` {\n    // TODO: implement\n    throw new Error('Not implemented');\n  }`;
    lines.push(`  ${tsVisibility} ${abstractKeyword}${method.name}(${method.params}): ${method.returnType}${body}`);
    if (!isInterface) lines.push("");
  }

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function mapVisibility(vis: string): string {
  switch (vis) {
    case "+":
    case "public":
      return "public";
    case "-":
    case "private":
      return "private";
    case "#":
    case "protected":
      return "protected";
    default:
      return "public";
  }
}
