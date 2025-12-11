/**
 * User Service Tests - Smart Signage v2.1
 * Testes unitários para UserService
 */

import { UserService } from '../../services/userService';
import { getDatabase } from '../../config/database';
import bcrypt from 'bcryptjs';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('UserService', () => {
  let userService: UserService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    userService = new UserService();
  });

  describe('getAllUsers', () => {
    it('deve listar usuários com paginação', async () => {
      const mockUsers = [
        {
          user_id: 1,
          username: 'testuser',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
          client_id: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockUsers);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await userService.getAllUsers({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('deve filtrar usuários por busca', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await userService.getAllUsers({ page: 1, limit: 10, search: 'test' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([expect.stringContaining('%test%')])
      );
    });

    it('deve filtrar usuários por role', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await userService.getAllUsers({ page: 1, limit: 10, role: 'admin' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('role ='),
        expect.arrayContaining(['admin'])
      );
    });
  });

  describe('getUserById', () => {
    it('deve retornar usuário quando encontrado', async () => {
      const mockUser = {
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(mockUser);

      const result = await userService.getUserById(1);

      expect(result).toEqual(mockUser);
    });

    it('deve retornar null quando usuário não encontrado', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await userService.getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('deve criar usuário com dados válidos', async () => {
      const mockUser = {
        user_id: 1,
        username: 'newuser',
        email: 'new@example.com',
        name: 'New User',
        role: 'client',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Verificar duplicidade
        .mockResolvedValueOnce(mockUser); // Buscar usuário criado

      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');
      mockDb.executeRaw.mockResolvedValue({ rows: [{ user_id: 1 }] });

      const result = await userService.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        role: 'client',
      });

      expect(result).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando usuário já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ user_id: 1 });

      await expect(
        userService.createUser({
          username: 'existing',
          password: 'password123',
          name: 'Existing User',
          role: 'client',
        })
      ).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('deve atualizar usuário existente', async () => {
      const mockUser = {
        user_id: 1,
        username: 'updateduser',
        email: 'updated@example.com',
        name: 'Updated User',
        role: 'admin',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ user_id: 1 }) // Verificar existência
        .mockResolvedValueOnce(mockUser); // Retornar atualizado
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await userService.updateUser(1, {
        name: 'Updated User',
      });

      expect(result).toEqual(mockUser);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve atualizar senha quando fornecida', async () => {
      const mockUser = {
        user_id: 1,
        username: 'testuser',
        name: 'Test User',
        role: 'admin',
        is_active: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ user_id: 1 })
        .mockResolvedValueOnce(mockUser);
      
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhash');
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await userService.updateUser(1, {
        password: 'newpassword123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', expect.any(Number));
    });
  });

  describe('deleteUser', () => {
    it('deve deletar usuário existente', async () => {
      mockDb.findFirst.mockResolvedValue({ user_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await userService.deleteUser(1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([1])
      );
    });

    it('deve lançar erro quando usuário não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(userService.deleteUser(999)).rejects.toThrow();
    });
  });
});

