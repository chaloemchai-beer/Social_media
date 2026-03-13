import bcrypt from 'bcryptjs';

export const comparePasswords = async (plainTextPassword: string, hashedPassword: string) => {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};
