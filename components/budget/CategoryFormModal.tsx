"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import IconColorPicker from "@/components/budget/IconColorPicker";
import type { FinCategory, CategoryKind } from "@/types/budget";

interface Props {
  userId: string;
  categories: FinCategory[]; // used to populate the parent-category picker
  category?: FinCategory;
  defaultKind?: CategoryKind;
  lockKind?: boolean;
  onClose: () => void;
  onSaved: (category: FinCategory) => void;
  onArchiveToggle?: () => void;
}

export default function CategoryFormModal({
  userId, categories, category, defaultKind = "EXPENSE", lockKind = false, onClose, onSaved, onArchiveToggle,
}: Props) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind);
  const [icon, setIcon] = useState(category?.icon ?? "shapes");
  const [color, setColor] = useState(category?.color ?? "#6366f1");
  const [isSubcategory, setIsSubcategory] = useState(!!category?.parent_id);
  const [parentId, setParentId] = useState(category?.parent_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Only top-level categories of the same kind can be a parent, and a
  // category can't become its own (grand)parent.
  const eligibleParents = categories.filter(
    (c) => c.kind === kind && !c.archived && !c.parent_id && c.id !== category?.id
  );

  function handleSubcategoryToggle(checked: boolean) {
    setIsSubcategory(checked);
    if (!checked) setParentId("");
    else if (!parentId) setParentId(eligibleParents[0]?.id ?? "");
  }

  // If the kind changes, the previously-picked parent may no longer be valid.
  useEffect(() => {
    if (isSubcategory && !eligibleParents.some((c) => c.id === parentId)) {
      setParentId(eligibleParents[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (isSubcategory && !parentId) { setError("Choose a parent category."); return; }

    setLoading(true);
    const supabase = createClient();
    const payload = { name: name.trim(), kind, icon, color, parent_id: isSubcategory ? parentId : null };

    const { data, error: dbError } = category
      ? await supabase.from("fin_categories").update(payload).eq("id", category.id).select().single()
      : await supabase.from("fin_categories").insert({ ...payload, user_id: userId }).select().single();

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onSaved(data as FinCategory);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          {category ? "Edit Category" : "New Category"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!lockKind && (
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as CategoryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  kind === k
                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                }`}
              >
                {k === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Groceries" />
          </div>

          {eligibleParents.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSubcategory}
                  onChange={(e) => handleSubcategoryToggle(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                This is a subcategory
              </label>
              {isSubcategory && (
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="input-field mt-2"
                >
                  {eligibleParents.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <IconColorPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Saving…" : "Save"}</button>
          </div>
          {onArchiveToggle && (
            <button type="button" onClick={onArchiveToggle} className="btn-ghost w-full text-xs">
              {category?.archived ? "Unarchive this category" : "Archive this category"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
