import { Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { UI_TEXT, BUTTON_SIZE_SM } from "../../constants";

interface ThreadItemMenuProps {
  onRename: () => void;
  onDelete?: () => void;
}

export function ThreadItemMenu({ onRename, onDelete }: ThreadItemMenuProps) {
  const t = useTranslations("history");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="relative ml-2 shrink-0">
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      >
        <DropdownMenuTrigger
          className={`flex ${BUTTON_SIZE_SM} hover:bg-accent/50 focus-visible:ring-ring items-center justify-center rounded-md transition-opacity focus-visible:ring-2 focus-visible:outline-none ${
            isMenuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRename();
              setIsMenuOpen(false);
            }}
          >
            <Edit2 className="h-4 w-4" />
            {t(UI_TEXT.rename)}
          </DropdownMenuItem>
          {onDelete && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setIsMenuOpen(false);
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              {t(UI_TEXT.delete)}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
