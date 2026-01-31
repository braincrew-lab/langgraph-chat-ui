/**
 * Schema Fields Section Component
 * Renders expandable section for optional schema fields only
 * Settings controls have been moved to ActionBar
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaField } from "./SchemaField";
import type { UseSchemaUIReturn } from "@/hooks/useSchemaUI";

interface SchemaFieldsSectionProps {
  schemaUI: UseSchemaUIReturn;
  disabled?: boolean;
  className?: string;
}

export function SchemaFieldsSection({
  schemaUI,
  disabled = false,
  className,
}: SchemaFieldsSectionProps) {
  const {
    parsedSchema,
    formState,
    setFieldValue,
    advancedExpanded,
    setAdvancedExpanded,
  } = schemaUI;

  const { optionalFields, rawSchema } = parsedSchema;

  // Don't render if no optional fields
  if (!optionalFields.length || !rawSchema) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn("px-4 pt-3", className)}
      >
        <div className="space-y-2 -mx-4 px-4 pb-3 border-b border-border/50">
          <button
            type="button"
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>고급 입력</span>
            <motion.span
              animate={{ rotate: advancedExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
            <span className="text-xs text-muted-foreground/60">
              ({optionalFields.length})
            </span>
          </button>

          <AnimatePresence initial={false}>
            {advancedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1 pl-3 border-l-2 border-muted max-h-[200px] overflow-y-auto">
                  {optionalFields.map((field) => (
                    <SchemaField
                      key={field.name}
                      field={field}
                      rootSchema={rawSchema}
                      value={formState[field.name]}
                      onChange={(value) => setFieldValue(field.name, value)}
                      disabled={disabled}
                      compact
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
