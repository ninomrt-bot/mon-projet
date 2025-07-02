// pages/alertes.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const fetcher = (u) => fetch(u).then((r) => r.json());
const TVA_RATE = 0.20; // 20 % de TVA

export default function AlertesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: rawStock, error, mutate } = useSWR("/api/stock", fetcher);

  // Construire le stock avec Ref en trim
  const stock = useMemo(
    () =>
      Array.isArray(rawStock)
        ? rawStock.map((r) => ({ ...r, Ref: String(r.Ref ?? "").trim() }))
        : [],
    [rawStock]
  );

  const [filterFourn, setFilterFourn] = useState("");
  const [showBC, setShowBC] = useState(false);
  const [bcFourn, setBcFourn] = useState("");
  const [lines, setLines] = useState([]);
  const [extraRef, setExtraRef] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [extraPU, setExtraPU] = useState(0);

  // Rediriger si pas authentifié
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Calculer les alertes (manque > 0)
  const alerts = useMemo(
    () =>
      stock
        .map((r) => {
          const dispo =
            Number(r["Qte stock"] ?? 0) + Number(r["En Commande"] ?? 0);
          const mini = Number(r["Qte mini"] ?? 0);
          const manque = mini - dispo;
          return manque > 0 ? { ...r, toOrder: manque } : null;
        })
        .filter(Boolean),
    [stock]
  );

  // Liste de fournisseurs pour filtrer
  const fournisseurs = useMemo(
    () =>
      Array.from(
        new Set(alerts.map((a) => a.Fournisseurs).filter(Boolean))
      ).sort(),
    [alerts]
  );

  // Alerte filtrée par fournisseur
  const filtered = filterFourn
    ? alerts.filter((a) => a.Fournisseurs === filterFourn)
    : alerts;

  // Dès qu’on ouvre la modale, préparer les lignes pour le BC
  useEffect(() => {
    if (!showBC) return;
    setLines(
      alerts
        .filter((a) => !bcFourn || a.Fournisseurs === bcFourn)
        .map((a) => ({
          Ref: a.Ref,
          description: a["Désignation"],
          qty: a.toOrder,
          pu: Number(a["PU HT"] ?? 0),
        }))
    );
    setExtraRef("");
    setExtraQty(1);
    setExtraPU(0);
  }, [showBC, bcFourn, alerts]);

  function openBC() {
    setBcFourn(filterFourn || fournisseurs[0] || "");
    setShowBC(true);
  }

  function addExtra() {
    const t = extraRef.trim();
    if (!t || extraQty < 1 || extraPU < 0) return;
    setLines((ls) => [
      ...ls,
      { Ref: t, description: "", qty: extraQty, pu: extraPU },
    ]);
    setExtraRef("");
    setExtraQty(1);
    setExtraPU(0);
  }

  const totals = useMemo(() => {
    const ht = lines.reduce((s, l) => s + l.qty * l.pu, 0);
    const tva = ht * TVA_RATE;
    return { ht, tva, ttc: ht + tva };
  }, [lines]);

  /* ───────── Génération PDF ───────── */
  async function generatePDF() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.addImage("/logo_stirweld.png", "PNG", 450, 20, 100, 40);
    doc.setFontSize(22).setTextColor("#00a6b2").text("Bon de commande", 40, 60);
    doc.setDrawColor("#00a6b2").line(40, 70, 555, 70);

    doc.setFontSize(12).setTextColor("#000");
    [
      "Stirweld SAS",
      "4K Rue du Lt Col Dubois",
      "35000 Rennes",
      "Tél. +33 2 99 00 00 00",
      "contact@stirweld.fr",
    ].forEach((l, i) => doc.text(l, 40, 90 + i * 14));

    doc.text("Destinataire :", 350, 90);
    doc.text(bcFourn, 350, 104);

    const y0 = 170;
    doc.setFontSize(10);
    doc.text(`Date : ${new Date().toLocaleDateString()}`, 40, y0);
    doc.text(`Fournisseur : ${bcFourn}`, 40, y0 + 14);

    autoTable(doc, {
      startY: y0 + 30,
      head: [["Marque", "Réf", "Description", "PU HT", "Qté", "Total HT", "TVA", "Total TTC"]],
      body: lines.map((l) => {
        const ht = l.qty * l.pu;
        const tva = ht * TVA_RATE;
        // Cherche la marque dans le stock
        const marque = (stock.find((s) => s.Ref === l.Ref) || {}).Marque || "";
        return [
          marque,
          l.Ref,
          l.description,
          l.pu.toFixed(2) + " €",
          String(l.qty),
          ht.toFixed(2) + " €",
          tva.toFixed(2) + " €",
          (ht + tva).toFixed(2) + " €",
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 166, 178] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text("Total HT :", 400, y);
    doc.text(totals.ht.toFixed(2) + " €", 520, y, { align: "right" });
    doc.text("Total TVA :", 400, y + 14);
    doc.text(totals.tva.toFixed(2) + " €", 520, y + 14, { align: "right" });
    doc
      .setTextColor("#00a6b2")
      .text("Total TTC :", 400, y + 28)
      .text(totals.ttc.toFixed(2) + " €", 520, y + 28, { align: "right" })
      .setTextColor("#000");

    const fileName = `BC_${bcFourn.replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);

    // Upload PDF → ajoute une commande “en cours”
    const blob = doc.output("blob");
    const fd = new FormData();
    fd.append("file", new File([blob], fileName, { type: "application/pdf" }));
    fd.append("fournisseur", bcFourn);
    fd.append("lignes", JSON.stringify(lines));
    await fetch("/api/commandes", { method: "POST", body: fd });

    // Maj “En Commande” dans le stock
    for (const l of lines) {
      const it = stock.find((s) => s.Ref === l.Ref);
      if (!it) continue;
      await fetch("/api/stock?edit=1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Ref: l.Ref,
          field: "En Commande",
          value: Number(it["En Commande"] || 0) + l.qty,
        }),
      });
    }
    await mutate("/api/stock");
    setShowBC(false);
  }

  /* ───────── Génération CSV (avec FormData) ───────── */
  async function generateCSV() {
    // 1) Construire le contenu CSV
    const headers = ["Marque", "Réf", "Description", "PU HT", "Qté", "Total HT", "TVA", "Total TTC"];
    const rows = lines.map((l) => {
      const ht = l.qty * l.pu;
      const tva = ht * TVA_RATE;
      const ttc = ht + tva;
      const marque = (stock.find((s) => s.Ref === l.Ref) || {}).Marque || "";
      return [
        marque,
        l.Ref,
        l.description,
        l.pu.toFixed(2).replace(".", ",") + " €",
        String(l.qty),
        ht.toFixed(2).replace(".", ",") + " €",
        tva.toFixed(2).replace(".", ",") + " €",
        ttc.toFixed(2).replace(".", ",") + " €",
      ];
    });
    const csvLines = [headers.join(";"), ...rows.map((r) => r.join(";"))];
    const csvContent = csvLines.join("\r\n");

    // 2) Préfixer le BOM UTF-8
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `BC_${bcFourn.replace(/\s+/g, "_")}.csv`;

    // 3) Télécharger localement
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, fileName);
    } else {
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // 4) FormData + POST pour créer la commande “en cours”
    const fd = new FormData();
    fd.append("file", new File([blob], fileName, { type: "text/csv;charset=utf-8;" }));
    fd.append("fournisseur", bcFourn);
    fd.append("lignes", JSON.stringify(lines));
    await fetch("/api/commandes", { method: "POST", body: fd });

    // 5) Maj “En Commande” dans le stock
    for (const l of lines) {
      const it = stock.find((s) => s.Ref === l.Ref);
      if (!it) continue;
      await fetch("/api/stock?edit=1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Ref: l.Ref,
          field: "En Commande",
          value: Number(it["En Commande"] || 0) + l.qty,
        }),
      });
    }
    await mutate("/api/stock");
    setShowBC(false);
  }

  if (status === "loading" || !session) return <p>Chargement…</p>;
  if (error) return <p>Erreur de chargement</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Alertes de stock bas</h1>

      {/* Filtres + bouton BC */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={filterFourn}
          onChange={(e) => setFilterFourn(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">— Tous fournisseurs —</option>
          {fournisseurs.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button
          onClick={openBC}
          disabled={!filtered.length}
          className="ml-auto bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
        >
          Générer bon de commande
        </button>
      </div>

      {/* Tableau alertes */}
      {filtered.length === 0 ? (
        <p>Aucune alerte pour ce fournisseur.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full table-auto">
            <thead className="bg-red-100">
              <tr>
                {[
                  "Marque",
                  "Ref",
                  "Désignation",
                  "Fournisseurs",
                  "Stock",
                  "Mini",
                  "À commander",
                ].map((h) => (
                  <th key={h} className="px-2 py-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.Ref + i} className={i % 2 ? "bg-red-50" : "bg-white"}>
                  <td className="px-2 py-1">{r.Marque}</td>
                  <td className="px-2 py-1">{r.Ref}</td>
                  <td className="px-2 py-1">{r["Désignation"]}</td>
                  <td className="px-2 py-1">{r.Fournisseurs}</td>
                  <td className="px-2 py-1">{r["Qte stock"]}</td>
                  <td className="px-2 py-1">{r["Qte mini"]}</td>
                  <td className="px-2 py-1 font-semibold">{r.toOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale BC */}
      {showBC && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white max-w-3xl w-full p-6 rounded shadow-lg space-y-4">
            <h2 className="text-xl font-bold">Bon de commande</h2>

            <label className="block">
              Fournisseur :
              <select
                value={bcFourn}
                onChange={(e) => setBcFourn(e.target.value)}
                className="border px-2 py-1 w-full mt-1"
              >
                {fournisseurs.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>

            {/* Lignes */}
            <div className="overflow-auto border rounded max-h-72">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {["Réf", "Description", "PU HT (€)", "Qté"].map((h) => (
                      <th key={h} className="px-2 py-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="px-2 py-1">{l.Ref}</td>
                      <td className="px-2 py-1">{l.description}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.pu}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            setLines((ls) => {
                              const nl = [...ls];
                              nl[i].pu = v;
                              return nl;
                            });
                          }}
                          className="w-24 border px-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value) || 1);
                            setLines((ls) => {
                              const nl = [...ls];
                              nl[i].qty = v;
                              return nl;
                            });
                          }}
                          className="w-16 border px-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ajout manuel */}
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1">
                Nouvelle réf
                <input
                  value={extraRef}
                  onChange={(e) => setExtraRef(e.target.value)}
                  className="border px-2 py-1 w-full"
                />
              </label>
              <label>
                PU HT (€)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={extraPU}
                  onChange={(e) => setExtraPU(Number(e.target.value))}
                  className="border px-2 py-1 w-24"
                />
              </label>
              <label>
                Qté
                <input
                  type="number"
                  min={1}
                  value={extraQty}
                  onChange={(e) => setExtraQty(Number(e.target.value))}
                  className="border px-2 py-1 w-20"
                />
              </label>
              <button
                onClick={addExtra}
                className="bg-green-600 text-white px-4 py-1 rounded"
              >
                + Ajouter
              </button>
            </div>

            {/* Totaux */}
            <div className="text-right pr-2">
              <p>Total HT : {totals.ht.toFixed(2)} €</p>
              <p>Total TVA : {totals.tva.toFixed(2)} €</p>
              <p className="font-bold text-teal-600">
                Total TTC : {totals.ttc.toFixed(2)} €
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBC(false)}
                className="px-4 py-1 border rounded"
              >
                Annuler
              </button>
              <button
                onClick={generatePDF}
                className="px-4 py-1 bg-blue-600 text-white rounded"
              >
                Générer PDF
              </button>
              <button
                onClick={generateCSV}
                className="px-4 py-1 bg-green-600 text-white rounded"
              >
                Générer CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
