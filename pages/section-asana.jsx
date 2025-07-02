// pages/section-asana.jsx
import React from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Link from "next/link";

const fetcher = url => fetch(url).then(res => res.json());

export default function SectionAsanaPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  // ID du projet englobant et ID de la section cible
  const ASANA_PROJECT_ID = "1209946324492253";
  const ASANA_SECTION_ID = "1209946817478639";

  // Si l’utilisateur n’est pas connecté, on n’appelle pas l’API
  const apiUrl = isAuthenticated
    ? `/api/asana/tasks?projectId=${ASANA_PROJECT_ID}&sectionId=${ASANA_SECTION_ID}`
    : null;

  const { data: tasksData, error } = useSWR(apiUrl, fetcher);

  // On s’assure que tasksList est toujours un tableau
  const tasksList = Array.isArray(tasksData) ? tasksData : [];

  if (!isAuthenticated) {
    return (
      <p className="p-6 text-red-600">
        Vous devez vous connecter pour voir les tâches de cette section.
      </p>
    );
  }
  if (error) {
    return (
      <p className="p-6 text-red-600">
        Erreur Asana : {error.error || error.message}
      </p>
    );
  }
  if (!tasksData) {
    return <p className="p-6">Chargement des tâches de la section…</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Section “Pôle Autom’/Elec” (ID {ASANA_SECTION_ID})
      </h1>

      {tasksList.length === 0 ? (
        <p>Aucune tâche trouvée dans cette section.</p>
      ) : (
        <div className="overflow-auto border rounded shadow">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Nom de la tâche</th>
                <th className="px-4 py-2 text-left">Assigné·e</th>
                <th className="px-4 py-2 text-left">Échéance</th>
                <th className="px-4 py-2 text-left">Priorité</th> {/* Ajouté */}
                <th className="px-4 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {tasksList.map(task => {
                console.log("TASK", task.name, task.custom_fields);
                // Cherche le champ personnalisé "Priorité"
                const prioriteField = (task.custom_fields || []).find(
                  f =>
                    f.name &&
                    f.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "priorite"
                );
                const priorite =
                  prioriteField?.display_value ||
                  prioriteField?.enum_value?.name ||
                  prioriteField?.text_value ||
                  prioriteField?.number_value ||
                  prioriteField?.name ||
                  "–";
                return (
                  <tr key={task.gid} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{task.name}</td>
                    <td className="border px-4 py-2">
                      {task.assignee?.name || "–"}
                    </td>
                    <td className="border px-4 py-2">{task.due_on || "–"}</td>
                    <td className="border px-4 py-2">{priorite}</td> {/* Ajouté */}
                    <td className="border px-4 py-2">
                      {task.completed ? (
                        <span className="inline-block px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                          Terminée
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs">
                          En cours
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Link href="/projects-asana">
          ← Retour aux onglets Asana
        </Link>
      </div>
    </div>
  );
}
