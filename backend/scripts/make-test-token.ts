import jwt from 'jsonwebtoken';

const userId = 'f7fb704e-e351-4098-b30f-f7f98359f070';
const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'aegis-super-secret-jwt-key-change-in-production-2024', { expiresIn: '1h' });
console.log(token);
