// pages/api/asana/project/[gid].js
export default async function handler(req, res) {
    const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Token Asana manquant" });
    }
    const { gid } = req.query;
  
    try {
      // 1) on récupère les sections du projet
      const secRes = await fetch(
        `https://app.asana.com/api/1.0/projects/${gid}/sections`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!secRes.ok) {
        const txt = await secRes.text();
        return res.status(secRes.status).json({ error: txt });
      }
      const { data: sections } = await secRes.json();
  
      // 2) pour chaque section, on récupère ses tâches
      const sectionsWithTasks = await Promise.all(
        sections.map(async (sec) => {
          const tasksRes = await fetch(
            `https://app.asana.com/api/1.0/sections/${sec.gid}/tasks?opt_fields=name,assignee_status,completed,assignee.name,due_on`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!tasksRes.ok) {
            return { ...sec, tasks: [], error: `Erreur ${tasksRes.status}` };
          }
          const { data: tasks } = await tasksRes.json();
          return { ...sec, tasks };
        })
      );
  
      res.status(200).json(sectionsWithTasks);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
  