import { ForumService } from '../forumService';

const mockDb = {};

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  collection: (...args) => mockCollection(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  writeBatch: () => mockWriteBatch(),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  increment: (val) => ({ _increment: val }),
  onSnapshot: jest.fn()
}));

describe('ForumService', () => {
  let forumService;

  beforeEach(() => {
    forumService = new ForumService(mockDb);
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('debería crear un post correctamente', async () => {
      mockCollection.mockReturnValue('posts-collection');
      mockDoc.mockReturnValue({ id: 'post-123' });
      mockSetDoc.mockResolvedValue(undefined);

      const postData = {
        title: 'Mi primer post',
        content: 'Contenido del post',
        category: 'general'
      };

      const postId = await forumService.createPost(postData, 'user-1');

      expect(postId).toBe('post-123');
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('getPost', () => {
    it('debería obtener un post e incrementar views', async () => {
      mockDoc.mockReturnValue('post-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'post-1',
        data: () => ({
          title: 'Test Post',
          content: 'Content',
          viewsCount: 5
        })
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const post = await forumService.getPost('post-1');

      expect(post).toEqual({
        id: 'post-1',
        title: 'Test Post',
        content: 'Content',
        viewsCount: 5
      });
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('debería retornar null si el post no existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const post = await forumService.getPost('non-existent');

      expect(post).toBeNull();
    });
  });

  describe('getPosts', () => {
    it('debería obtener todos los posts sin filtro', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'post-1', data: () => ({ title: 'Post 1' }) },
          { id: 'post-2', data: () => ({ title: 'Post 2' }) }
        ]
      });

      const posts = await forumService.getPosts();

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe('Post 1');
    });

    it('debería filtrar posts por categoría', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'post-1', data: () => ({ title: 'Post 1', category: 'tech' }) }
        ]
      });

      const posts = await forumService.getPosts('tech');

      expect(posts).toHaveLength(1);
      expect(posts[0].category).toBe('tech');
    });
  });

  describe('updatePost', () => {
    it('debería actualizar un post', async () => {
      mockDoc.mockReturnValue('post-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await forumService.updatePost('post-1', { title: 'Updated Title' });

      expect(mockUpdateDoc).toHaveBeenCalledWith('post-ref', {
        title: 'Updated Title',
        updatedAt: expect.any(Object)
      });
    });
  });

  describe('deletePost', () => {
    it('debería eliminar post y sus comentarios', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: 'comment-ref-1' },
          { ref: 'comment-ref-2' }
        ]
      });

      await forumService.deletePost('post-1');

      expect(mockBatch.delete).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('debería añadir comentario y actualizar contador', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockCollection.mockReturnValue('comments-collection');
      mockDoc.mockReturnValue({ id: 'comment-123' });

      const commentId = await forumService.addComment(
        'post-1',
        { text: 'Great post!' },
        'user-1'
      );

      expect(commentId).toBe('comment-123');
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('getComments', () => {
    it('debería obtener comentarios de un post', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'comment-1', data: () => ({ text: 'Comment 1' }) },
          { id: 'comment-2', data: () => ({ text: 'Comment 2' }) }
        ]
      });

      const comments = await forumService.getComments('post-1');

      expect(comments).toHaveLength(2);
      expect(comments[0].text).toBe('Comment 1');
    });
  });

  describe('deleteComment', () => {
    it('debería eliminar comentario y decrementar contador', async () => {
      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);

      await forumService.deleteComment('post-1', 'comment-1');

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('toggleLike', () => {
    it('debería añadir like si no existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);

      const liked = await forumService.toggleLike('post-1', 'user-1');

      expect(liked).toBe(true);
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('debería quitar like si ya existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true
      });

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);

      const liked = await forumService.toggleLike('post-1', 'user-1');

      expect(liked).toBe(false);
      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('toggleCommentLike', () => {
    it('debería añadir like a comentario', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);

      const liked = await forumService.toggleCommentLike('post-1', 'comment-1', 'user-1');

      expect(liked).toBe(true);
      expect(mockBatch.set).toHaveBeenCalled();
    });

    it('debería quitar like de comentario', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true
      });

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);

      const liked = await forumService.toggleCommentLike('post-1', 'comment-1', 'user-1');

      expect(liked).toBe(false);
      expect(mockBatch.delete).toHaveBeenCalled();
    });
  });
});