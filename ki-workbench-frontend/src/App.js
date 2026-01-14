// App.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios"; // HTTP requests to backend
import "./index.css"; // load styles

/* --------------------------------------------------------------------------
   CONFIG
--------------------------------------------------------------------------- */
const API_BASE = "http://localhost:4000"; // change if needed

/* --------------------------------------------------------------------------
   ID HELPER
--------------------------------------------------------------------------- */
const uid = () =>
  window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* --------------------------------------------------------------------------
   DOMAIN MODELS
--------------------------------------------------------------------------- */
const newTool = () => ({
  id: uid(),
  name: "",
  commandLine: "",
  status: "Missing",
  optionList: [],
  inputIds: [],
  outputIds: [],
});

const newArtefact = (type = "txt") => ({
  id: uid(),
  name: "New Artefact",
  type,
  data: "",
  version: 1,
  dateISO: new Date().toISOString(),
  meta: [{ key: "author", value: "" }],
  params: [{ key: "param", value: "" }],
});

/* --------------------------------------------------------------------------
   ROOT COMPONENT
--------------------------------------------------------------------------- */
export default function App() {
  const [tools, setTools] = useState([]);
  const [artefacts, setArtefacts] = useState([]);

  const [view, setView] = useState("dashboard");
  const [activeToolId, setActiveToolId] = useState(null);
  const [activeArtefactId, setActiveArtefactId] = useState(null);
  const [artefactLinkKind, setArtefactLinkKind] = useState(null);
  const [search, setSearch] = useState("");

  /* ------------------------- LOAD FROM BACKEND ------------------------- */
  useEffect(() => {
    axios.get(`${API_BASE}/tools`).then((res) => setTools(res.data));
    axios.get(`${API_BASE}/artefacts`).then((res) => setArtefacts(res.data));
  }, []);

  /* ---------------------- DERIVED DATA ---------------------- */
  const toolsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => t.name.toLowerCase().includes(q));
  }, [tools, search]);

  const artefactById = (id) => artefacts.find((a) => a.id === id);

  /* ---------------------- NAVIGATION HELPERS ---------------------- */
  const goDashboard = () => {
    setView("dashboard");
    setActiveToolId(null);
    setActiveArtefactId(null);
    setArtefactLinkKind(null);
  };

  /* ---------------------- TOOL ACTIONS ---------------------- */
  const onCreateTool = () => {
    // ✅ Only create a draft tool in frontend
    const t = newTool();
    setTools((prev) => [t, ...prev]);
    setActiveToolId(t.id);
    setView("tool");
  };

  const onSaveTool = async (tool) => {
    const exists = tools.some((t) => t.id === tool.id);
    if (exists) {
      await axios.put(`${API_BASE}/tools/${tool.id}`, tool);
      setTools((prev) => prev.map((t) => (t.id === tool.id ? tool : t)));
    } else {
      await axios.post(`${API_BASE}/tools`, tool);
      setTools((prev) => [tool, ...prev]);
    }
    goDashboard(); // ✅ back after save
  };

  const onEditTool = (toolId) => {
    setActiveToolId(toolId);
    setView("tool");
  };

  const onDeleteTool = async (toolId) => {
    await axios.delete(`${API_BASE}/tools/${toolId}`);
    setTools((prev) => prev.filter((t) => t.id !== toolId));
  };

  /* ------------------- ARTEFACT ACTIONS ------------------- */
  const onOpenArtefactForCreate = (kind) => {
    const a = newArtefact("txt");
    setArtefacts((prev) => [a, ...prev]);
    setActiveArtefactId(a.id);
    setArtefactLinkKind(kind);
    setView("artefact");
  };

  const onOpenArtefactForEdit = (artefactId) => {
    setActiveArtefactId(artefactId);
    setArtefactLinkKind(null);
    setView("artefact");
  };

  const onSaveArtefact = async (updated) => {
    const withVersion = {
      ...updated,
      version: (updated.version || 0) + 1,
      dateISO: new Date().toISOString(),
    };

    const exists = artefacts.some((a) => a.id === withVersion.id);
    if (exists) {
      await axios.put(`${API_BASE}/artefacts/${withVersion.id}`, withVersion);
      setArtefacts((prev) =>
        prev.map((a) => (a.id === withVersion.id ? withVersion : a))
      );
    } else {
      await axios.post(`${API_BASE}/artefacts`, withVersion);
      setArtefacts((prev) => [withVersion, ...prev]);
    }

    if (artefactLinkKind && activeToolId) {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== activeToolId) return t;
          let updatedTool = { ...t };
          if (
            artefactLinkKind === "input" &&
            !updatedTool.inputIds.includes(updated.id)
          ) {
            updatedTool.inputIds = [...updatedTool.inputIds, updated.id];
          }
          if (
            artefactLinkKind === "output" &&
            !updatedTool.outputIds.includes(updated.id)
          ) {
            updatedTool.outputIds = [...updatedTool.outputIds, updated.id];
          }
          axios.put(`${API_BASE}/tools/${updatedTool.id}`, updatedTool);
          return updatedTool;
        })
      );
    }

    if (activeToolId) setView("tool");
    else goDashboard();
  };

  const onDeleteArtefact = async (artefactId) => {
    await axios.delete(`${API_BASE}/artefacts/${artefactId}`);
    setTools((prev) =>
      prev.map((t) => ({
        ...t,
        inputIds: t.inputIds.filter((id) => id !== artefactId),
        outputIds: t.outputIds.filter((id) => id !== artefactId),
      }))
    );
    setArtefacts((prev) => prev.filter((a) => a.id !== artefactId));
    goDashboard();
  };

  /* ---------------------- DASHBOARD ARTEFACT ADDERS ---------------------- */
  const onAddInputFromDashboard = (toolId) => {
    setActiveToolId(toolId);
    onOpenArtefactForCreate("input");
  };

  const onAddOutputFromDashboard = (toolId) => {
    setActiveToolId(toolId);
    onOpenArtefactForCreate("output");
  };

  /* ---------------------- RENDER ---------------------- */
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">AI Workbench</div>
        <div className="topbar-actions">
          <div className="search">
            <input
              className="input"
              placeholder="Search tools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={onCreateTool}>
            + New Tool
          </button>
        </div>
      </header>

      {view === "dashboard" && (
        <Dashboard
          tools={toolsFiltered}
          artefactById={artefactById}
          onEditTool={onEditTool}
          onDeleteTool={onDeleteTool}
          onOpenArtefactForEdit={onOpenArtefactForEdit}
          onAddInputFromDashboard={onAddInputFromDashboard}
          onAddOutputFromDashboard={onAddOutputFromDashboard}
        />
      )}

      {view === "tool" && activeToolId && (
        <ToolEditor
          tool={tools.find((t) => t.id === activeToolId)}
          setTool={(tUpd) =>
            setTools((prev) => prev.map((t) => (t.id === tUpd.id ? tUpd : t)))
          }
          artefactById={artefactById}
          onAddInput={() => onOpenArtefactForCreate("input")}
          onAddOutput={() => onOpenArtefactForCreate("output")}
          onEditArtefact={onOpenArtefactForEdit}
          onSaveTool={onSaveTool}
          onClose={goDashboard}
        />
      )}

      {view === "artefact" && activeArtefactId && (
        <ArtefactEditor
          artefact={artefacts.find((a) => a.id === activeArtefactId)}
          setArtefact={(aUpd) =>
            setArtefacts((prev) =>
              prev.map((a) => (a.id === aUpd.id ? aUpd : a))
            )
          }
          onSave={onSaveArtefact}
          onDelete={onDeleteArtefact}
          onClose={goDashboard}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   DASHBOARD COMPONENT
   WHY: shows cards for each tool with inputs/outputs as clickable chips.
--------------------------------------------------------------------------- */
function Dashboard({
  tools,
  artefactById,
  onEditTool,
  onDeleteTool,
  onOpenArtefactForEdit,
  onAddInputFromDashboard,
  onAddOutputFromDashboard,
}) {
  return (
    <main className="container fade-in">
      {!tools || tools.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid">
          {tools.map((t) => (
            <div className="card" key={t.id}>
              <div className="card-head">
                <div>
                  <div className="title">{t.name || "Unnamed Tool"}</div>
                  <div className={`status status-${t.status.toLowerCase()}`}>
                    {t.status}
                  </div>
                </div>

                <div className="actions">
                  {/* Edit button */}
                  <button
                    className="btn btn-small"
                    onClick={() => onEditTool(t.id)}
                  >
                    Edit
                  </button>
                  {/* Delete button */}
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDeleteTool(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="row">
                <label>Command</label>
                <code className="code">{t.commandLine || "—"}</code>
              </div>

              <div className="row">
                <label>Inputs</label>
                <div className="chips">
                  {!t.inputIds || t.inputIds.length === 0 ? (
                    <button
                      className="chip chip-placeholder"
                      onClick={() => onAddInputFromDashboard(t.id)}
                    >
                      + Add Input
                    </button>
                  ) : (
                    t.inputIds.map((id) => {
                      const a = artefactById(id);
                      if (!a) return null;
                      return (
                        <button
                          key={id}
                          className={`chip chip-${a.type}`}
                          onClick={() => onOpenArtefactForEdit(id)}
                          title={`${a.type.toUpperCase()} v${a.version}`}
                        >
                          {a.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="row">
                <label>Outputs</label>
                <div className="chips">
                  {!t.outputIds || t.outputIds.length === 0 ? (
                    <button
                      className="chip chip-placeholder"
                      onClick={() => onAddOutputFromDashboard(t.id)}
                    >
                      + Add Output
                    </button>
                  ) : (
                    t.outputIds.map((id) => {
                      const a = artefactById(id);
                      if (!a) return null;
                      return (
                        <button
                          key={id}
                          className={`chip chip-${a.type}`}
                          onClick={() => onOpenArtefactForEdit(id)}
                          title={`${a.type.toUpperCase()} v${a.version}`}
                        >
                          {a.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// Empty state shown when no tools exist
function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-title">No tools yet</div>
      <div className="empty-sub">
        Use “+ New Tool” to create your first tool.
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   TOOL EDITOR
   WHY: edit tool metadata, add inputs/outputs & options.
--------------------------------------------------------------------------- */
function ToolEditor({
  tool,
  setTool,
  artefactById,
  onAddInput,
  onAddOutput,
  onEditArtefact,
  onSaveTool,
  onClose,
}) {
  if (!tool) return null;

  //ensure all arrays exist
  tool.optionList = tool.optionList || [];
  tool.inputIds = tool.inputIds || [];
  tool.outputIds = tool.outputIds || [];
  // helper to update field
  const setField = (k, v) => setTool({ ...tool, [k]: v });

  // add option
  const addOption = () =>
    setTool({
      ...tool,
      optionList: [...tool.optionList, { name: "", type: "string", value: "" }],
    });

  // update option
  const updateOption = (idx, k, v) => {
    const next = [...tool.optionList];
    next[idx] = { ...next[idx], [k]: v };
    setTool({ ...tool, optionList: next });
  };

  // remove option
  const removeOption = (idx) => {
    const next = [...tool.optionList];
    next.splice(idx, 1);
    setTool({ ...tool, optionList: next });
  };

  // unlink artefact
  const unlinkArtefact = (kind, artefactId) => {
    const key = kind === "input" ? "inputIds" : "outputIds";
    setTool({ ...tool, [key]: tool[key].filter((id) => id !== artefactId) });
  };

  return (
    <div className="panel fade-in">
      <div className="panel-head">
        <div className="title">Edit Tool</div>
        <button className="btn btn-secondary" onClick={onClose}>
          Back to Dashboard
        </button>
      </div>

      <div className="form">
        {/* BASIC INFO FIRST */}
        <label>Name</label>
        <input
          className="input"
          value={tool.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <label>Command Line</label>
        <input
          className="input"
          value={tool.commandLine}
          onChange={(e) => setField("commandLine", e.target.value)}
        />

        <label>Status</label>
        <select
          className="input"
          value={tool.status}
          onChange={(e) => setField("status", e.target.value)}
        >
          <option>Missing</option>
          <option>RequiresUpdate</option>
          <option>UpToDate</option>
        </select>

        {/* OPTIONS */}
        <div className="subsection">
          <div className="sub-head">
            <div className="subtitle">Options</div>
            <button className="btn btn-secondary" onClick={addOption}>
              + Add Option
            </button>
          </div>

          {tool.optionList.length === 0 && (
            <div className="muted">No options</div>
          )}

          {tool.optionList.map((o, i) => (
            <div className="option-row" key={i}>
              <input
                className="input"
                placeholder="Name"
                value={o.name}
                onChange={(e) => updateOption(i, "name", e.target.value)}
              />
              <select
                className="input"
                value={o.type}
                onChange={(e) => updateOption(i, "type", e.target.value)}
              >
                <option>string</option>
                <option>number</option>
                <option>boolean</option>
              </select>
              <input
                className="input"
                placeholder="Value"
                value={o.value}
                onChange={(e) => updateOption(i, "value", e.target.value)}
              />
              <button
                className="btn btn-text btn-danger"
                onClick={() => removeOption(i)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* INPUTS */}
        <div className="subsection">
          <div className="sub-head">
            <div className="subtitle">Inputs</div>
            <button className="btn btn-success" onClick={onAddInput}>
              + Add Input
            </button>
          </div>
          <div className="chips">
            {(!tool.inputIds || tool.inputIds.length === 0) && (
              <button className="chip chip-placeholder" onClick={onAddInput}>
                None (Click to add)
              </button>
            )}
            {tool.inputIds &&
              tool.inputIds.map((id) => {
                const a = artefactById(id);
                if (!a) return null;
                return (
                  <div className="chipline" key={id}>
                    <button
                      className={`chip chip-${a.type}`}
                      onClick={() => onEditArtefact(id)}
                    >
                      {a.name} <span className="muted">v{a.version}</span>
                    </button>
                    <button
                      className="btn btn-text"
                      onClick={() => unlinkArtefact("input", id)}
                    >
                      Unlink
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* OUTPUTS */}
        <div className="subsection">
          <div className="sub-head">
            <div className="subtitle">Outputs</div>
            <button className="btn btn-success" onClick={onAddOutput}>
              + Add Output
            </button>
          </div>
          <div className="chips">
            {(!tool.outputIds || tool.outputIds.length === 0) && (
              <button className="chip chip-placeholder" onClick={onAddOutput}>
                None (Click to add)
              </button>
            )}
            {tool.outputIds &&
              tool.outputIds.map((id) => {
                const a = artefactById(id);
                if (!a) return null;
                return (
                  <div className="chipline" key={id}>
                    <button
                      className={`chip chip-${a.type}`}
                      onClick={() => onEditArtefact(id)}
                    >
                      {a.name} <span className="muted">v{a.version}</span>
                    </button>
                    <button
                      className="btn btn-text"
                      onClick={() => unlinkArtefact("output", id)}
                    >
                      Unlink
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="actions-right">
          <button className="btn btn-primary" onClick={() => onSaveTool(tool)}>
            Save Tool
          </button>
        </div>
      </div>
    </div>
  );
}
/* --------------------------------------------------------------------------
   ARTEFACT EDITOR
   WHY: supports text/csv editing, image upload (stored as base64), params, save/delete.
--------------------------------------------------------------------------- */
function ArtefactEditor({ artefact, setArtefact, onSave, onDelete, onClose }) {
  // local draft for editing
  const [draft, setDraft] = useState(artefact || {});

  // keep draft in sync if artefact changes
  useEffect(() => {
    if (artefact) setDraft(artefact);
  }, [artefact]);

  if (!artefact) return null; // guard after hooks

  // helper to set a draft field
  const setField = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }));

  // upload handler: images as base64, text/csv as plain text
  const onUpload = (file) => {
    if (!file) return;
    const r = new FileReader();
    const mime = file.type.toLowerCase();

    let targetType = "txt";
    if (mime.includes("csv")) targetType = "csv";
    else if (mime.includes("png")) targetType = "png";
    else if (mime.includes("jpeg") || mime.includes("jpg")) targetType = "jpeg";

    if (targetType === "png" || targetType === "jpeg") {
      r.onload = (e) =>
        setDraft((prev) => ({
          ...prev,
          data: e.target.result,
          type: targetType,
        }));
      r.readAsDataURL(file);
    } else {
      r.onload = (e) =>
        setDraft((prev) => ({
          ...prev,
          data: e.target.result,
          type: targetType,
        }));
      r.readAsText(file);
    }
  };

  // preview: textarea for txt/csv, <img> for images
  const preview =
    draft.type === "txt" ? (
      <textarea
        className="input textarea"
        rows={10}
        value={draft.data}
        onChange={(e) => setField("data", e.target.value)}
      />
    ) : draft.type === "csv" ? (
      <textarea
        className="input textarea"
        rows={6}
        value={draft.data}
        onChange={(e) => setField("data", e.target.value)}
      />
    ) : draft.data ? (
      <img className="image" src={draft.data} alt={draft.name} />
    ) : (
      <div className="muted">No image data yet</div>
    );

  return (
    <div className="panel fade-in">
      <div className="panel-head">
        <div className="title">Artefact</div>
        <button className="btn btn-secondary" onClick={onClose}>
          Back to Dashboard
        </button>
      </div>

      <div className="form">
        <label>Name</label>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <label>Type</label>
        <select
          className="input"
          value={draft.type}
          onChange={(e) => setField("type", e.target.value)}
        >
          <option value="txt">txt</option>
          <option value="csv">csv</option>
          <option value="png">png</option>
          <option value="jpeg">jpeg</option>
        </select>

        <label>Upload file</label>
        <input
          type="file"
          accept=".txt,.csv,.png,.jpeg,.jpg"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />

        <label>Parameters</label>
        {draft.params?.map((p, i) => (
          <div className="kv-edit" key={i}>
            <input
              className="input"
              value={p.key}
              placeholder="key"
              onChange={(e) => {
                const next = [...(draft.params || [])];
                next[i] = { ...next[i], key: e.target.value };
                setField("params", next);
              }}
            />
            <input
              className="input"
              value={p.value}
              placeholder="Value"
              onChange={(e) => {
                const next = [...(draft.params || [])];
                next[i] = { ...next[i], value: e.target.value };
                setField("params", next);
              }}
            />
          </div>
        ))}
        <button
          className="btn btn-secondary"
          onClick={() =>
            setField("params", [
              ...(draft.params || []),
              { key: "", value: "" },
            ])
          }
        >
          + Add Param
        </button>

        <label>Preview</label>
        {preview}

        <div className="actions-right">
          <button className="btn" onClick={() => onSave(draft)}>
            Save
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(artefact.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
