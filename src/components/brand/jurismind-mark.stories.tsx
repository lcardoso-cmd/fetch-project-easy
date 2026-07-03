import type { Meta, StoryObj } from "@storybook/react";
import { JurisMindMark, type JurisMindContext, type JurisMindVariant } from "./jurismind-mark";

const meta: Meta<typeof JurisMindMark> = {
  title: "Brand/JurisMindMark",
  component: JurisMindMark,
  tags: ["autodocs"],
  argTypes: {
    context: {
      control: "select",
      options: [
        "sidebar",
        "header",
        "landing",
        "auth",
        "chat",
        "chip-dark",
        "inline-light",
        "inline-dark",
      ],
      description: "Semantic layout context — resolves to the correct variant automatically.",
    },
    variant: {
      control: "select",
      options: ["sidebar", "square-navy", "square-white", "glyph-navy", "glyph-white"],
      description: "Explicit variant override. Prefer context unless you need a specific asset.",
    },
    size: {
      control: { type: "number" },
      description: "Icon size in pixels.",
    },
    rounded: {
      control: "boolean",
      description: "Force rounded corners. Square variants are rounded by default.",
    },
  },
};

export default meta;

type Story = StoryObj<typeof JurisMindMark>;

export const Playground: Story = {
  args: {
    context: "header",
    size: 40,
  },
};

const contexts: JurisMindContext[] = [
  "sidebar",
  "header",
  "landing",
  "auth",
  "chat",
  "chip-dark",
  "inline-light",
  "inline-dark",
];

export const AllContexts: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {contexts.map((context) => (
        <div key={context} className="flex flex-col items-center gap-3 rounded-lg border p-4">
          <JurisMindMark context={context} size={48} />
          <span className="text-xs font-mono text-muted-foreground">{context}</span>
        </div>
      ))}
    </div>
  ),
};

const variants: JurisMindVariant[] = [
  "sidebar",
  "square-navy",
  "square-white",
  "glyph-navy",
  "glyph-white",
];

export const VariantOverride: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-medium">
          Same context (header), different variant overrides
        </h3>
        <div className="flex flex-wrap gap-6">
          {variants.map((variant) => (
            <div key={variant} className="flex flex-col items-center gap-2">
              <JurisMindMark context="header" variant={variant} size={48} />
              <span className="text-xs font-mono text-muted-foreground">{variant}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-medium">Without context (raw variant)</h3>
        <div className="flex flex-wrap gap-6">
          {variants.map((variant) => (
            <div key={variant} className="flex flex-col items-center gap-2">
              <JurisMindMark variant={variant} size={48} />
              <span className="text-xs font-mono text-muted-foreground">{variant}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

/**
 * Renderização com `context` explicitamente `null`/`undefined`.
 * O componente deve cair no fallback seguro sem quebrar.
 */
export const ContextNullish: Story = {
  name: "Context: null / undefined",
  render: () => (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
      <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
        <JurisMindMark context={null as unknown as JurisMindContext} size={48} />
        <span className="text-xs font-mono text-muted-foreground">context={"{null}"}</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
        <JurisMindMark context={undefined} size={48} />
        <span className="text-xs font-mono text-muted-foreground">context={"{undefined}"}</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
        <JurisMindMark size={48} />
        <span className="text-xs font-mono text-muted-foreground">sem prop</span>
      </div>
    </div>
  ),
};

/**
 * Contextos inválidos vindos de dados externos (query string, API, config).
 * Deve emitir warning de fallback (ver console) mas continuar renderizando.
 */
const invalidContexts = ["", "footer", "SIDEBAR", "sidebar ", "unknown", 42, {}] as const;

export const ContextInvalid: Story = {
  name: "Context: valores inválidos",
  render: () => (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {invalidContexts.map((value, index) => (
        <div
          key={index}
          className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 p-4"
        >
          <JurisMindMark context={value as unknown as JurisMindContext} size={48} />
          <span className="text-xs font-mono text-muted-foreground">
            {JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Variants válidos isolados (sem context).
 */
export const VariantValid: Story = {
  name: "Variant: todos os válidos",
  render: () => (
    <div className="flex flex-wrap gap-6">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <JurisMindMark variant={variant} size={48} />
          <span className="text-xs font-mono text-muted-foreground">{variant}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Variants inválidos — devem cair no fallback e emitir warning.
 */
const invalidVariants = ["", "square", "glyph", "SIDEBAR", "square-black", 0, null] as const;

export const VariantInvalid: Story = {
  name: "Variant: valores inválidos",
  render: () => (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {invalidVariants.map((value, index) => (
        <div
          key={index}
          className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 p-4"
        >
          <JurisMindMark variant={value as unknown as JurisMindVariant} size={48} />
          <span className="text-xs font-mono text-muted-foreground">
            {JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  ),
};
