/**
 * Client Service Tests - Smart Signage v2.1
 * Testes unitários para ClientService
 */

import { ClientService } from '../../services/clientService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('ClientService', () => {
  let clientService: ClientService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    clientService = new ClientService();
  });

  describe('getAllClients', () => {
    it('deve listar clientes com paginação', async () => {
      const mockClients = [
        {
          client_id: 1,
          name: 'Cliente Teste',
          email: 'teste@example.com',
          phone: '123456789',
          address: 'Rua Teste',
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockClients);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await clientService.getAllClients({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockClients);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('deve filtrar clientes por busca', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await clientService.getAllClients({ page: 1, limit: 10, search: 'teste' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([expect.stringContaining('%teste%')])
      );
    });
  });

  describe('getClientById', () => {
    it('deve retornar cliente quando encontrado', async () => {
      const mockClient = {
        client_id: 1,
        name: 'Cliente Teste',
        email: 'teste@example.com',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(mockClient);

      const result = await clientService.getClientById(1);

      expect(result).toEqual(mockClient);
      expect(mockDb.findFirst).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('deve retornar null quando cliente não encontrado', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await clientService.getClientById(999);

      expect(result).toBeNull();
    });
  });

  describe('createClient', () => {
    it('deve criar cliente com dados válidos', async () => {
      const mockClient = {
        client_id: 1,
        name: 'Novo Cliente',
        email: 'novo@example.com',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Cliente não existe
        .mockResolvedValueOnce(mockClient); // Retornar criado
      
      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });

      const result = await clientService.createClient({
        name: 'Novo Cliente',
        email: 'novo@example.com',
      });

      expect(result).toEqual(mockClient);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando cliente já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ client_id: 1 });

      await expect(
        clientService.createClient({ name: 'Cliente Existente' })
      ).rejects.toThrow('Cliente com este nome já existe');
    });
  });

  describe('updateClient', () => {
    it('deve atualizar cliente existente', async () => {
      const mockClient = {
        client_id: 1,
        name: 'Cliente Atualizado',
        email: 'atualizado@example.com',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ client_id: 1 }) // Verificar existência
        .mockResolvedValueOnce(null) // Nenhum cliente com mesmo nome
        .mockResolvedValueOnce(mockClient); // Retornar atualizado
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await clientService.updateClient(1, {
        name: 'Cliente Atualizado',
      });

      expect(result).toEqual(mockClient);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando cliente não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        clientService.updateClient(999, { name: 'Teste' })
      ).rejects.toThrow();
    });
  });

  describe('deleteClient', () => {
    it('deve deletar cliente existente', async () => {
      mockDb.findFirst.mockResolvedValue({ client_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await clientService.deleteClient(1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clients'),
        expect.arrayContaining([1])
      );
    });

    it('deve lançar erro quando cliente não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(clientService.deleteClient(999)).rejects.toThrow();
    });
  });
});

