
import { PrismaClient } from './generated/prisma'; // chemin relatif depuis lib/prisma.js


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

export default prisma;
