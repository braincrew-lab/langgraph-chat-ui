"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  Save,
  GripVertical,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  createRubricItemAction,
  updateRubricItemAction,
  deleteRubricItemAction,
  reorderRubricItemsAction,
} from "@/app/actions/feedback";

interface RubricItem {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RubricManagerProps {
  initialItems: RubricItem[];
}

export function RubricManager({ initialItems }: RubricManagerProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deactivateDialog, setDeactivateDialog] = useState<RubricItem | null>(
    null,
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createRubricItemAction({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      if (result.success) {
        setNewName("");
        setNewDescription("");
        setAddDialogOpen(false);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const handleStartEdit = (item: RubricItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || "");
  };

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      const result = await updateRubricItemAction(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      if (result.success) {
        setEditingId(null);
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: editName.trim(),
                  description: editDescription.trim() || null,
                }
              : item,
          ),
        );
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const handleDeactivate = (item: RubricItem) => {
    startTransition(async () => {
      const result = await deleteRubricItemAction(item.id);
      if (result.success) {
        setDeactivateDialog(null);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isActive: false } : i)),
        );
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const handleReactivate = (item: RubricItem) => {
    startTransition(async () => {
      const result = await updateRubricItemAction(item.id, { isActive: true });
      if (result.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isActive: true } : i)),
        );
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    [newItems[index], newItems[targetIndex]] = [
      newItems[targetIndex],
      newItems[index],
    ];

    // Update orders
    const reordered = newItems.map((item, i) => ({ ...item, order: i }));
    setItems(reordered);

    startTransition(async () => {
      await reorderRubricItemsAction(
        reordered.map((item) => ({ id: item.id, order: item.order })),
      );
      router.refresh();
    });
  };

  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {activeItems.length} {t("feedback.rubric.active")} /{" "}
          {inactiveItems.length} {t("feedback.rubric.inactive")}
        </p>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("feedback.rubric.addItem")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("feedback.rubric.addTitle")}</DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("feedback.rubric.name")}</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("feedback.rubric.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("feedback.rubric.descriptionLabel")}</Label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t("feedback.rubric.descriptionPlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button
                onClick={handleAdd}
                disabled={isPending || !newName.trim()}
              >
                {isPending ? tc("loading") : t("feedback.rubric.addItem")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {t("feedback.rubric.noItems")}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`border-border/70 flex items-center gap-3 rounded-lg border p-3 ${
                !item.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="text-muted-foreground flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0 || isPending}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <GripVertical className="text-muted-foreground/40 h-4 w-4 self-center" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => handleMove(index, "down")}
                  disabled={index === items.length - 1 || isPending}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={t("feedback.rubric.descriptionPlaceholder")}
                      className="h-8"
                    />
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => handleStartEdit(item)}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-muted-foreground text-xs">
                        {item.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={item.isActive ? "default" : "secondary"}>
                  {item.isActive
                    ? t("feedback.rubric.active")
                    : t("feedback.rubric.inactive")}
                </Badge>

                {editingId === item.id ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingId(null)}
                    >
                      {tc("cancel")}
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : item.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={() => setDeactivateDialog(item)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReactivate(item)}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deactivateDialog}
        onOpenChange={(open) => !open && setDeactivateDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("feedback.table.deleteFeedback")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.rubric.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateDialog) {
                  handleDeactivate(deactivateDialog);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
