// pages/projects-asana/[gid].jsx
import { useRouter } from "next/router";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AsanaProjectDetail() {
  const { query } = useRouter();
  const gid = query.gid;
  const { data, error } = useSWR(
    gid ? `/api/asana/project/${gid}` : null,
    fetcher
  );

  if (!gid) return <p>Chargement du GID…</p>;
  if (error) return <p className="text-red-600">Erreur Asana : {error.error||error}</p>;
  if (!data) return <p>Chargement des sections…</p>;

  return (
    <div className="p-6 space-y-6">
      <Link href="/projects-asana">
        <button className="text-sm text-blue-600 hover:underline">← Retour aux projets</button>
      </Link>

      {data.map((section) => (
        <div key={section.gid} className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">{section.name}</h2>
          {section.error && (
            <p className="text-red-500">Erreur section : {section.error}</p>
          )}
          {section.tasks.length === 0 ? (
            <p className="text-gray-500">Aucune tâche dans cette section.</p>
          ) : (
            <table className="w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  {["Nom", "Assigné à", "Statut", "Échéance", "Priorité"].map((h) => (
                    <th key={h} className="px-2 py-1 text-left text-sm">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.tasks.map((t) => {
                  // Cherche le champ personnalisé "Priorité"
                  const prioriteField = (t.custom_fields || []).find(
                    (f) =>
                      f.name &&
                      f.name.trim().toLowerCase().replace(/é/g, "e") === "priorite"
                  );
                  const priorite =
                    prioriteField?.display_value ||
                    prioriteField?.enum_value?.name ||
                    prioriteField?.text_value ||
                    prioriteField?.number_value ||
                    prioriteField?.name ||
                    "–";
                  return (
                    <tr key={t.gid} className="hover:bg-gray-50">
                      <td className="px-2 py-1">{t.name}</td>
                      <td className="px-2 py-1">{t.assignee?.name || "—"}</td>
                      <td className="px-2 py-1">
                        {t.completed ? "Terminé" : t.assignee_status}
                      </td>
                      <td className="px-2 py-1">{t.due_on || "—"}</td>
                      <td className="px-2 py-1">{priorite}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
