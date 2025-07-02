// pages/projects-asana/index.jsx
import React, { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ProjectsAsanaPage() {
  // 1) ID du projet Asana
  const ASANA_PROJECT_ID = "1209946324492253"; // Pôle Autom’/Elec

  // 2) Appel SWR pour récupérer toutes les tâches de ce projet
  const { data: tasksData, error: tasksError } = useSWR(
    `/api/asana/tasks?projectId=${ASANA_PROJECT_ID}`,
    fetcher
  );

  // 3) Normaliser les tâches en tableau
  const tasksList = useMemo(() => {
    if (!Array.isArray(tasksData)) return [];
    return tasksData.map((task) => {
      // Extraire nom de section (première membership)
      const sectionName =
        task.memberships && task.memberships.length > 0
          ? task.memberships[0].section.name
          : "Sans section";

      // Transformer custom_fields en objet clé:valeur
      const cfObj = {};
      if (Array.isArray(task.custom_fields)) {
        task.custom_fields.forEach((cf) => {
          cfObj[cf.name] = cf.display_value;
        });
      }

      return {
        gid: task.gid,
        name: task.name,
        assignee: task.assignee?.name || "–",
        dueDate: task.due_on || "–",
        completed: task.completed,
        section: sectionName,
        statut: cfObj["Statut"] || "–",
        relecteur: cfObj["Relecteur"] || "–",
        barreur: cfObj["Barreur"] || "–",
        complexite: cfObj["Complexité"] || "–",
        demarrage: cfObj["Démarrage"] || "–",
        cableurMonteur: cfObj["Câbleur/Monteur"] || "–",
        priorite: cfObj["Priorité"] || "–",
      };
    });
  }, [tasksData]);

  // 4) Regrouper les tâches par section
  const tasksBySection = useMemo(() => {
    const groups = {};
    tasksList.forEach((t) => {
      if (!groups[t.section]) groups[t.section] = [];
      groups[t.section].push(t);
    });
    return groups;
  }, [tasksList]);

  // 5) Gestion des sections ouvertes (state local)
  //    On stocke un objet dont les clés sont les noms de section, la valeur est true si ouverte.
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (sectionName) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // 6) Gestion des états d’erreur / chargement
  if (tasksError) {
    return (
      <p className="p-6 text-red-600">
        Erreur Asana : {tasksError.error || tasksError.message}
      </p>
    );
  }
  if (!tasksData) {
    return <p className="p-6">Chargement des tâches du projet…</p>;
  }
  if (tasksList.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Pôle Autom’/Elec (Asana)</h1>
        <p>Aucune tâche trouvée dans ce projet.</p>
        <div className="mt-6">
          <Link href="/">← Retour au Dashboard</Link>
        </div>
      </div>
    );
  }

  // 7) Affichage final avec accordéons
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pôle Autom’/Elec (Asana)</h1>

      {Object.entries(tasksBySection).map(([sectionName, tasksSection]) => (
        <div key={sectionName} className="mb-4 border rounded overflow-hidden">
          {/* En-tête de la section */}
          <button
            onClick={() => toggleSection(sectionName)}
            className="w-full flex justify-between items-center bg-gray-100 px-4 py-2 hover:bg-gray-200"
          >
            <span className="text-lg font-medium text-gray-800">
              {sectionName}
            </span>
            <span className="text-gray-600">
              {openSections[sectionName] ? "–" : "+"}
            </span>
          </button>

          {/* Contenu dépliable */}
          {openSections[sectionName] && (
            <ul className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tasksSection.map((t) => (
                <li
                  key={t.gid}
                  className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                      {t.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        t.completed
                          ? "bg-green-200 text-green-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {t.completed ? "Terminée" : "En cours"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      <strong>Responsable :</strong> {t.assignee}
                    </div>
                    <div>
                      <strong>Échéance :</strong> {t.dueDate}
                    </div>
                    <div>
                      <strong>Statut :</strong> {t.statut}
                    </div>
                    <div>
                      <strong>Relecteur :</strong> {t.relecteur}
                    </div>
                    <div>
                      <strong>Barreur :</strong> {t.barreur}
                    </div>
                    <div>
                      <strong>Complexité :</strong> {t.complexite}
                    </div>
                    <div>
                      <strong>Priorité :</strong> {t.priorite}
                    </div>
                    <div>
                      <strong>Démarrage :</strong> {t.demarrage}
                    </div>
                    <div className="col-span-2">
                      <strong>Câbleur/Monteur :</strong> {t.cableurMonteur}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="mt-6">
        <Link href="/">← Retour au Dashboard</Link>
      </div>
    </div>
  );
}
