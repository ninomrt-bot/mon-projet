// lib/hooks/useProjectTasks.js
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

/**
 * useProjectTasks récupère la liste des tâches d’un projet Asana,
 * ou d’une section précise si `sectionId` est fourni.
 *
 * @param {string} projectId  - ID du projet Asana (ex: "1209946324492253")
 * @param {string} [sectionId] - ID de la section (ex: "1209946817478639")
 *
 * @returns {{
 *   tasks: Array,
 *   isLoading: boolean,
 *   isError: boolean
 * }}
 */
export function useProjectTasks(projectId, sectionId = null) {
  // Construire l’URL avec query params
  let url = `/api/project/tasks?projectId=${projectId}`;
  if (sectionId) {
    url += `&sectionId=${sectionId}`;
  }

  const { data, error } = useSWR(projectId ? url : null, fetcher);

  return {
    tasks: Array.isArray(data) ? data : [],
    isLoading: !error && !data,
    isError: !!error,
  };
}
