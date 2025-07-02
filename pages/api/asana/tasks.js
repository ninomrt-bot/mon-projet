// pages/api/asana/tasks.js
export default async function handler(req, res) {
  // 1) Récupérer le PAT depuis les variables d'environnement
  const accessToken = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
  if (!accessToken) {
    return res
      .status(500)
      .json({ error: "Le token Asana n’est pas configuré." });
  }

  // 2) Lire projectId depuis la query (sectionId sera ignoré ici)
  const { projectId } = req.query;
  if (!projectId) {
    return res
      .status(400)
      .json({ error: "Le paramètre projectId est requis." });
  }

  try {
    // 3) Construire l’URL Asana pour récupérer toutes les tâches du projet
    //    → /projects/{projectId}/tasks?opt_fields=...
    const commonFields = [
      "gid",
      "name",
      "completed",
      "assignee.name",
      "due_on",
      "memberships.section.name",
      "custom_fields.name",
      "custom_fields.display_value",
      "custom_fields.enum_value.name",   // ← ajoute cette ligne
      "custom_fields.text_value",        // ← ajoute cette ligne
      "custom_fields.number_value",      // ← ajoute cette ligne
    ].join(",");

    const url = `https://app.asana.com/api/1.0/projects/${projectId}/tasks?opt_fields=${encodeURIComponent(commonFields)}`;

    // 4) Appeler l’API Asana
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      console.error("Erreur API Asana :", response.status, errorJson);
      return res.status(response.status).json({
        error: errorJson,
        message: "Erreur lors de l’appel à l’API Asana.",
      });
    }

    // 5) Extraire le tableau de tâches
    const json = await response.json();
    const tasksArray = Array.isArray(json.data) ? json.data : [];

    return res.status(200).json(tasksArray);
  } catch (error) {
    console.error("Asana fetch error (tasks):", error);
    return res
      .status(500)
      .json({ error: "Impossible de récupérer les tâches Asana." });
  }
}
