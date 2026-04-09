/**
 * Java class template
 * Generates Java class code from a diagram node
 */

export interface JavaClassTemplateVars {
  className: string;
  packageName?: string;
  isAbstract?: boolean;
  isInterface?: boolean;
  attributes: Array<{ visibility: string; name: string; type: string }>;
  methods: Array<{ visibility: string; name: string; params: string; returnType: string }>;
  extendsClass?: string;
  implementsInterfaces?: string[];
  framework?: string;
}

/**
 * Render a Java class from template variables
 */
export function renderJavaClass(vars: JavaClassTemplateVars): string {
  const { className, packageName, isAbstract, isInterface, attributes, methods, extendsClass, implementsInterfaces, framework } = vars;

  const lines: string[] = [];

  // Package declaration
  if (packageName) {
    lines.push(`package ${packageName};`);
    lines.push("");
  }

  // Framework-specific imports
  if (framework === "spring") {
    lines.push("import org.springframework.stereotype.Service;");
    lines.push("import org.springframework.beans.factory.annotation.Autowired;");
    lines.push("");
  }

  // Class declaration
  const keyword = isInterface ? "interface" : isAbstract ? "abstract class" : "class";
  let declaration = `public ${keyword} ${className}`;

  if (!isInterface && extendsClass) {
    declaration += ` extends ${extendsClass}`;
  }
  if (implementsInterfaces && implementsInterfaces.length > 0) {
    const kw = isInterface ? "extends" : "implements";
    declaration += ` ${kw} ${implementsInterfaces.join(", ")}`;
  }
  declaration += " {";
  lines.push(declaration);
  lines.push("");

  // Fields
  for (const attr of attributes) {
    const javaVisibility = mapVisibility(attr.visibility);
    const javaType = toJavaType(attr.type);
    lines.push(`    ${javaVisibility} ${javaType} ${attr.name};`);
  }
  if (attributes.length > 0) lines.push("");

  // Constructor
  if (!isInterface && attributes.length > 0) {
    const ctorParams = attributes
      .map((a) => `${toJavaType(a.type)} ${a.name}`)
      .join(", ");
    lines.push(`    public ${className}(${ctorParams}) {`);
    for (const attr of attributes) {
      lines.push(`        this.${attr.name} = ${attr.name};`);
    }
    lines.push("    }");
    lines.push("");
  }

  // Methods
  for (const method of methods) {
    const javaVisibility = mapVisibility(method.visibility);
    const javaReturn = toJavaType(method.returnType);
    const abstractKeyword = isAbstract && !isInterface ? "abstract " : "";
    const body = isInterface ? ";" : isAbstract && abstractKeyword ? ";" : ` {\n        // TODO: implement\n        throw new UnsupportedOperationException("Not implemented");\n    }`;
    lines.push(`    ${javaVisibility} ${abstractKeyword}${javaReturn} ${method.name}(${method.params})${body}`);
    lines.push("");
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

function toJavaType(tsType: string): string {
  const map: Record<string, string> = {
    string: "String",
    number: "double",
    boolean: "boolean",
    void: "void",
    any: "Object",
    "string[]": "String[]",
    "number[]": "double[]",
  };
  return map[tsType] ?? tsType;
}
