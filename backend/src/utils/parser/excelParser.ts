import * as XLSX from 'xlsx';
import { FileParseError } from '../errors.js';

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export async function parseExcel(filePath: string): Promise<ParsedData> {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

    if (data.length === 0) {
      throw new FileParseError('Excel 文件为空');
    }

    // First row is headers
    const headers = data[0].map(String);
    
    // Rest are data rows
    const rows = data.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ?? null;
      });
      return obj;
    });

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  } catch (error: any) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(`Excel 解析失败: ${error.message}`);
  }
}
