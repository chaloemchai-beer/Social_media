import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { email, password, name } = await request.json() as {
      email: string
      password: string
      name: string
    }
    const hashedPassword = bcrypt.hashSync(password, 10)

    const user = await prisma.user.create({
      data: {
        email,  
        password: hashedPassword,
        name,
      },
    })
    return NextResponse.json({ message: 'User created', user })
  } catch (error) {
    return NextResponse.json({ error: 'User could not be created' }, { status: 500 })
  }
}
