import { PrismaClient } from '@prisma/client';

console.log('Creating PrismaClient instance');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

console.log('PrismaClient initialized:', !!prisma);

export default prisma;
