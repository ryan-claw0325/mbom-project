import { readFile } from 'fs/promises';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { FileParseError } from '../errors.js';

const parseXml = promisify(parseString);

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export async function parseTCXML(filePath: string): Promise<ParsedData> {
  try {
    const xmlContent = await readFile(filePath, 'utf-8');
    const result = await parseXml(xmlContent);
    
    // Teamcenter XML structure varies, this is a common pattern
    // Adjust based on actual TC BOM export format
    const items = result.ConfigurationItems?.Item || result.BOMList?.Item || [];
    
    if (!Array.isArray(items) || items.length === 0) {
      // Try to find any array in the XML
      const keys = Object.keys(result);
      for (const key of keys) {
        if (Array.isArray(result[key]) && result[key].length > 0) {
          const rows = result[key].map((item: any) => {
            const obj: Record<string, any> = {};
            if (typeof item === 'object') {
              Object.keys(item).forEach(k => {
                obj[k] = Array.isArray(item[k]) ? item[k][0] : item[k];
              });
            }
            return obj;
          });
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          return { headers, rows, totalRows: rows.length };
        }
      }
      throw new FileParseError('无法解析 Teamcenter XML 结构');
    }

    const rows = items.map((item: any) => {
      const obj: Record<string, any> = {};
      Object.keys(item).forEach(key => {
        const value = item[key];
        obj[key] = Array.isArray(value) ? value[0] : value;
      });
      return obj;
    });

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  } catch (error: any) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(`XML 解析失败: ${error.message}`);
  }
}
