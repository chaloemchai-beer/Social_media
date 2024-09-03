import bcrypt from 'bcrypt';

export const comparePasswords = async (plainTextPassword: string, hashedPassword: string) => {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};
