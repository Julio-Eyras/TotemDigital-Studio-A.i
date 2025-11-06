/**
 * Export Formats - Smart Signage v2.1
 * Funções de exportação para diferentes formatos (Excel, PDF, CSV)
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as createCsvWriter from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Exporta dados para Excel
 */
export async function exportToExcel(
  data: any[],
  exportConfig: any,
  fileName: string,
  sheetName: string
): Promise<string> {
  try {
    // Criar diretório se não existir
    const outputDir = exportConfig.outputDirectory || './exports';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Gerar nome do arquivo com timestamp
    const timestamp = exportConfig.timestampSuffix !== false
      ? new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      : '';
    const fileExt = '.xlsx';
    const fileNameWithTimestamp = timestamp
      ? `${fileName}_${timestamp}${fileExt}`
      : `${fileName}${fileExt}`;
    const filePath = path.join(outputDir, fileNameWithTimestamp);

    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Adicionar cabeçalhos
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Formatar cabeçalho
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Adicionar dados
      data.forEach(row => {
        const values = headers.map(header => row[header]);
        worksheet.addRow(values);
      });

      // Ajustar largura das colunas
      worksheet.columns.forEach((column, index) => {
        let maxLength = 0;
        worksheet.getColumn(index + 1).eachCell({ includeEmpty: false }, (cell) => {
          const cellLength = cell.value ? cell.value.toString().length : 10;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      });

      // Aplicar formatação se configurado
      if (exportConfig.applyFormatting !== false) {
        // Formatar datas
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.eachCell((cell, colNumber) => {
              if (cell.value instanceof Date) {
                cell.numFmt = exportConfig.dateFormat || 'dd/mm/yyyy HH:mm:ss';
              } else if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00';
              }
            });
          }
        });
      }

      // Adicionar filtros
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length }
      };
    }

    // Salvar arquivo
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  } catch (error: any) {
    throw new Error(`Erro ao exportar para Excel: ${error.message}`);
  }
}

/**
 * Exporta dados para PDF
 */
export async function exportToPDF(
  data: any[],
  exportConfig: any,
  fileName: string
): Promise<string> {
  try {
    // Criar diretório se não existir
    const outputDir = exportConfig.outputDirectory || './exports';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Gerar nome do arquivo com timestamp
    const timestamp = exportConfig.timestampSuffix !== false
      ? new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      : '';
    const fileExt = '.pdf';
    const fileNameWithTimestamp = timestamp
      ? `${fileName}_${timestamp}${fileExt}`
      : `${fileName}${fileExt}`;
    const filePath = path.join(outputDir, fileNameWithTimestamp);

    // Criar documento PDF
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Adicionar título
    doc.fontSize(18).text(fileName, { align: 'center' });
    doc.moveDown();

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const pageWidth = doc.page.width - 100; // Margens
      const colWidth = pageWidth / headers.length;

      // Cabeçalho da tabela
      doc.fontSize(10).font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, index) => {
        doc.text(header, x, doc.y, {
          width: colWidth,
          align: 'left'
        });
        x += colWidth;
      });
      doc.moveDown();
      doc.strokeColor('#000000').lineWidth(0.5).moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke();

      // Dados
      doc.font('Helvetica').fontSize(9);
      data.forEach((row, rowIndex) => {
        // Verificar se precisa de nova página
        if (doc.y > doc.page.height - 50) {
          doc.addPage();
          // Re-imprimir cabeçalho
          doc.fontSize(10).font('Helvetica-Bold');
          x = 50;
          headers.forEach((header) => {
            doc.text(header, x, doc.y, {
              width: colWidth,
              align: 'left'
            });
            x += colWidth;
          });
          doc.moveDown();
          doc.strokeColor('#000000').lineWidth(0.5).moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke();
          doc.font('Helvetica').fontSize(9);
        }

        x = 50;
        headers.forEach((header, index) => {
          const value = row[header];
          const displayValue = value instanceof Date
            ? value.toLocaleString('pt-BR')
            : value !== null && value !== undefined
            ? String(value)
            : '';
          
          doc.text(displayValue, x, doc.y, {
            width: colWidth,
            align: 'left'
          });
          x += colWidth;
        });
        doc.moveDown();

        // Linha separadora a cada 10 linhas
        if ((rowIndex + 1) % 10 === 0) {
          doc.strokeColor('#CCCCCC').lineWidth(0.3).moveTo(50, doc.y).lineTo(pageWidth + 50, doc.y).stroke();
          doc.moveDown();
        }
      });
    } else {
      doc.text('Nenhum dado encontrado', { align: 'center' });
    }

    // Finalizar PDF
    doc.end();

    // Aguardar stream finalizar
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', (error) => reject(new Error(`Erro ao exportar para PDF: ${error.message}`)));
    });
  } catch (error: any) {
    throw new Error(`Erro ao exportar para PDF: ${error.message}`);
  }
}

/**
 * Exporta dados para CSV
 */
export async function exportToCSV(
  data: any[],
  exportConfig: any,
  fileName: string
): Promise<string> {
  try {
    // Criar diretório se não existir
    const outputDir = exportConfig.outputDirectory || './exports';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Gerar nome do arquivo com timestamp
    const timestamp = exportConfig.timestampSuffix !== false
      ? new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      : '';
    const fileExt = '.csv';
    const fileNameWithTimestamp = timestamp
      ? `${fileName}_${timestamp}${fileExt}`
      : `${fileName}${fileExt}`;
    const filePath = path.join(outputDir, fileNameWithTimestamp);

    if (data.length === 0) {
      // Criar arquivo CSV vazio
      fs.writeFileSync(filePath, '');
      return filePath;
    }

    // Preparar headers
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.map(header => ({
      id: header,
      title: header
    }));

    // Criar CSV writer
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: filePath,
      header: csvHeaders,
      encoding: 'utf8'
    });

    // Escrever dados
    await csvWriter.writeRecords(data);

    return filePath;
  } catch (error: any) {
    throw new Error(`Erro ao exportar para CSV: ${error.message}`);
  }
}

