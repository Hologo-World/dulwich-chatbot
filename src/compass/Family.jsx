import { useCallback, useEffect, useState } from "react";
import { useLion } from "../lion/Lion";
import Compass from "./Compass";
import { YEARS } from "./journeyData";
import { emptyFamily, loadFamily, newChild, saveFamily } from "./storage";

// ─────────────────────────────────────────────────────────────
// One family, several children. Each child has their own selections,
// journey, history and saved state. The journey shows one child at a
// time; the bar at the top switches between them.
// ─────────────────────────────────────────────────────────────

const yearLabel = (y) => YEARS.find((x) => x.value === y)?.label;
export const childLabel = (child, index) =>
  child?.name?.trim() || `Child ${index + 1}`;

function childSummary(child) {
  const d = child.data;
  if (!d?.ctx || d.ctx.year == null) return "Not started";
  const year = yearLabel(d.ctx.year);
  return d.phase === "journey" ? `${year}, journey ready` : year;
}

export default function CompassFamily() {
  const [family, setFamily] = useState(() => loadFamily() || emptyFamily());
  const { setChildren, requestedChild, clearRequest, forgetChild } = useLion();

  useEffect(() => {
    saveFamily(family);
  }, [family]);

  // Tell the chat who's in the family, so it can show a chat per child
  useEffect(() => {
    setChildren(
      family.children.map((c, i) => ({ id: c.id, label: childLabel(c, i) })),
    );
  }, [family.children, setChildren]);

  // A child picked in the chat: show their journey too
  useEffect(() => {
    if (!requestedChild) return;
    if (family.children.some((c) => c.id === requestedChild)) {
      setFamily((f) => ({ ...f, activeId: requestedChild }));
    }
    clearRequest();
  }, [requestedChild, family.children, clearRequest]);

  const index = Math.max(
    0,
    family.children.findIndex((c) => c.id === family.activeId),
  );
  const active = family.children[index];
  const label = childLabel(active, index);

  const updateChild = useCallback((id, patch) => {
    setFamily((f) => ({
      ...f,
      children: f.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const addChild = () => {
    const child = newChild();
    setFamily((f) => ({
      activeId: child.id,
      children: [...f.children, child],
    }));
  };

  const removeChild = (id) => {
    if (
      !window.confirm(
        `Remove ${label}, their journey and their chat from this browser?`,
      )
    )
      return;
    forgetChild(id);
    setFamily((f) => {
      const rest = f.children.filter((c) => c.id !== id);
      if (!rest.length) return emptyFamily();
      return {
        activeId: f.activeId === id ? rest[0].id : f.activeId,
        children: rest,
      };
    });
  };

  return (
    <div className="family">
      <div className="family-bar">
        <div
          className="family-bar__tabs"
          role="tablist"
          aria-label="Your children"
        >
          {family.children.map((c, i) => {
            const name = childLabel(c, i);
            const selected = c.id === active.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`child-tab${selected ? " child-tab--on" : ""}`}
                onClick={() => setFamily((f) => ({ ...f, activeId: c.id }))}
              >
                <span className="child-tab__avatar" aria-hidden="true">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="child-tab__text">
                  {name}
                  <small>{childSummary(c)}</small>
                </span>
              </button>
            );
          })}
          <button type="button" className="child-add" onClick={addChild}>
            + Add a child
          </button>
        </div>
        {family.children.length > 1 && (
          <button
            type="button"
            className="link child-remove"
            onClick={() => removeChild(active.id)}
          >
            Remove {label}
          </button>
        )}
      </div>

      {/* key: switching child remounts Compass with that child's saved state */}
      <Compass
        key={active.id}
        child={active}
        label={label}
        familySize={family.children.length}
        onSave={(data) => updateChild(active.id, { data })}
        onRename={(name) => updateChild(active.id, { name })}
      />
    </div>
  );
}
