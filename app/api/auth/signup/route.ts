import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      birthday, 
      gender 
    } = await request.json() as {
      firstName: string
      lastName: string
      email: string
      password: string
      birthday: string
      gender: string
    }

    // Validate input
    if (!firstName || !lastName || !email || !password || !birthday || !gender) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        birthday: new Date(birthday), // Convert string to Date object
        gender,
      },
    })

    // Remove password from the response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({ 
      message: 'User created successfully', 
      user: userWithoutPassword 
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'User could not be created' }, { status: 500 })
  }
}