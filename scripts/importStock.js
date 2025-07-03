const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '..', 'Stock.xlsm'); // Chemin vers ton fichier Excel
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  for (const row of data) {
    try {
      await prisma.stockItem.create({
        data: {
          marque: row["Marque"]?.toString() || '',
          ref: row["Ref"]?.toString() || '',
          designation: row["Désignation"]?.toString() || '',
          fournisseurs: row["Fournisseurs"]?.toString() || '',
          qteStock: parseInt(row["Qte stock"]) || 0,
          qteMini: parseInt(row["Qte mini"]) || 0,
          qteCmd: parseInt(row["Qte à Cmd"]) || 0,
          reception: row["Réception"]?.toString().toLowerCase().trim() === 'oui', // ou adapte si c'est un bool
        }
      });
    } catch (err) {
      console.error("Erreur avec une ligne :", row, err);
    }
  }

  console.log("✅ Import terminé !");
  await prisma.$disconnect();
}

main();
