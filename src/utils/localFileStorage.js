import { get, set, del, update } from 'idb-keyval';

const METADATA_KEY = 'leeio_files_metadata';
const FILE_PREFIX = 'leeio_file_';

// Metadata structure: { name, size, type, lastModified, source: 'local' | 'drive', driveId? }

export const localFileStorage = {
  // Save file and metadata
  async saveFile(file, source = 'local', driveId = null) {
    try {
      const fileName = file.name;
      
      // 1. Save file blob
      await set(FILE_PREFIX + fileName, file);
      
      // 2. Update metadata list
      await update(METADATA_KEY, (val) => {
        const list = val || [];
        const existingIndex = list.findIndex(f => f.name === fileName);
        
        const newEntry = {
          name: fileName,
          size: file.size,
          type: file.type,
          lastModified: new Date().toISOString(),
          source,
          driveId
        };

        if (existingIndex >= 0) {
          list[existingIndex] = newEntry;
          return list;
        }
        return [...list, newEntry];
      });
      
      console.log(`File ${fileName} saved locally via IndexedDB`);
      return true;
    } catch (error) {
      console.error('Error saving file locally:', error);
      return false;
    }
  },

  // Get list of all saved files metadata
  async getFiles() {
    try {
      return (await get(METADATA_KEY)) || [];
    } catch (error) {
      console.error('Error fetching local files:', error);
      return [];
    }
  },

  // Get specific file blob
  async getFile(fileName) {
    try {
      return await get(FILE_PREFIX + fileName);
    } catch (error) {
      console.error('Error getting file content:', error);
      return null;
    }
  },

  // Delete file
  async deleteFile(fileName) {
    try {
      await del(FILE_PREFIX + fileName);
      await update(METADATA_KEY, (val) => {
        return (val || []).filter(f => f.name !== fileName);
      });
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
};
