"use client";

import { useState, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useTranslations } from "next-intl";

interface StringArrayInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}

export function StringArrayInput({
  value,
  onChange,
  placeholder,
  maxItems = 20,
}: StringArrayInputProps) {
  const t = useTranslations('admin');
  const [inputValue, setInputValue] = useState("");
  const resolvedPlaceholder = placeholder || t('stringArray.addPlaceholder');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && value.length < maxItems && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, newValue: string) => {
    const newArray = [...value];
    newArray[index] = newValue;
    onChange(newArray);
  };

  return (
    <div className="space-y-3">
      {/* Item list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
            >
              <Input
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
                onClick={() => handleRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      {value.length < maxItems && (
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={resolvedPlaceholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Item count */}
      <p className="text-muted-foreground text-xs">
        {t('stringArray.itemCount', { count: value.length, max: maxItems })}
      </p>
    </div>
  );
}
