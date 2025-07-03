-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "marque" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "fournisseurs" TEXT NOT NULL,
    "qteStock" INTEGER NOT NULL,
    "qteMini" INTEGER NOT NULL,
    "qteCmd" INTEGER NOT NULL,
    "reception" BOOLEAN NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
