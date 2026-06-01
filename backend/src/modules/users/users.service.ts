import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  getUsers() {
    return this.prisma.users.findMany({
      select: {
        user_id: true, username: true, first_name: true, last_name: true,
        email: true, role_id: true, department_id: true, updated_at: true,
      },
      orderBy: { user_id: 'asc' },
    })
  }

  getRoles() { 
    return this.prisma.role.findMany({ 
      orderBy: { role_id: 'asc' } 
    }) 
  }

  async createUser(data: {
    username: string; first_name: string; last_name: string
    email?: string; role_id?: number; department_id?: number
  }) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.users.aggregate({ _max: { user_id: true } })
      return tx.users.create({
        data: {
          user_id: (last._max.user_id ?? 0) + 1,
          username: data.username?.trim(),
          first_name: data.first_name?.trim(),
          last_name: data.last_name?.trim(),
          email: data.email?.trim() || null,
          role_id: data.role_id,
          department_id: data.department_id,
          updated_at: now,
        },
        select: { user_id: true, username: true, first_name: true, last_name: true, email: true },
      })
    })
  }

  updateUser(id: number, data: Partial<{
    username: string; first_name: string; last_name: string
    email: string; role_id: number; department_id: number
  }>) {
    return this.prisma.users.update({
      where: { user_id: id },
      data: { ...data, updated_at: new Date() },
      select: { user_id: true, username: true, first_name: true, last_name: true },
    })
  }

  deleteUser(id: number) {
    return this.prisma.users.delete({ where: { user_id: id } })
  }

  async createRole(data: { role_name: string; role_name_eng?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.role.aggregate({ _max: { role_id: true } })
      return tx.role.create({
        data: {
          role_id: (last._max.role_id ?? 0) + 1,
          role_name: data.role_name?.trim(),
          role_name_eng: data.role_name_eng?.trim() || null,
        },
      })
    })
  }

  updateRole(id: number, data: Partial<{ role_name: string; role_name_eng: string }>) {
    return this.prisma.role.update({ where: { role_id: id }, data })
  }
}
