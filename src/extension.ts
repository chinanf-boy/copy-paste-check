import * as vscode from 'vscode';

import { DuplicatedCode } from './duplicated-code';
import { DuplicatedCodeProvider } from './duplicated-code.provider';
import { IClone } from 'jscpd';
import path from 'path';

interface IOpenTargetFileArguments {
  uri: string, 
  preview: boolean,
  selection?: vscode.Selection,
  justPlaceCursor?: boolean,
}

const duplicatedCodeDecorationType = vscode.window.createTextEditorDecorationType({
  borderWidth: '0',
  overviewRulerColor: 'blue',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  light: {
      // this color will be used in light color themes
      backgroundColor: 'lightblue'
  },
  dark: {
      // this color will be used in dark color themes
      backgroundColor: 'darkblue'
  }
});

function createDecorationsOnTextEditor(duplicatedCodeProvider: DuplicatedCodeProvider, textEditor: vscode.TextEditor | undefined) {
  if (!textEditor) { return; }

  const fileName = textEditor?.document.fileName.replace(/\\/g, '/');
  const clones = duplicatedCodeProvider.getClones();
  const clonesInThisFile = clones
    .map(c => {
      const sideA = ((clone: IClone) => {
        if (clone.duplicationA.sourceId === fileName) { return true; }
        else if (clone.duplicationB.sourceId === fileName) { return false; }
        else { return null; }
      })(c);
      return { ...c, sideA: sideA };
    })
    .filter(c => c.sideA);
  
  textEditor?.setDecorations(duplicatedCodeDecorationType, clonesInThisFile.map(c => {
    const duplication = c.sideA! ? c.duplicationA : c.duplicationB;
    const duplicationOtherSide = c.sideA! ? c.duplicationB : c.duplicationA;
    const otherSidePath = path.relative(fileName, duplicationOtherSide.sourceId);
    const duplicationOtherSideStart = duplicationOtherSide.start;
    const duplicationOtherSideStartString = `${duplicationOtherSideStart.line}:${duplicationOtherSideStart.column ?? 1}`;
    
    const args: IOpenTargetFileArguments = {
      uri: duplicationOtherSide.sourceId,
      preview: true,
      selection: new vscode.Selection(
        duplicationOtherSide.start.line - 1, (duplicationOtherSide.start.column ?? 1) - 1,
        duplicationOtherSide.end.line - 1, (duplicationOtherSide.end.column ?? 1) - 1
      ),
      justPlaceCursor: true,
    };
    const openCommandUri = vscode.Uri.parse(
      `command:duplicatedCode.openTargetFile?${encodeURIComponent(JSON.stringify(args))}`
    );

    const hoverMessageContent = new vscode.MarkdownString(`Duplicated code found in **${otherSidePath}**:${duplicationOtherSideStartString} ([review](${openCommandUri})):\n`
    + '```\n' + duplicationOtherSide?.fragment + '\n```');
    hoverMessageContent.isTrusted = true;

    return { 
      range: new vscode.Range(
        duplication!.start.line - 1, (duplication!.start.column ?? 1) - 1, 
        duplication!.end.line - 1, (duplication!.end.column ?? 1) - 1),
        hoverMessage: hoverMessageContent, 
      };
    }));
}

export function activate() {
  const duplicatedCodeProvider = new DuplicatedCodeProvider(vscode.workspace.workspaceFolders);
  vscode.window.registerTreeDataProvider('duplicatedCode', duplicatedCodeProvider);
  duplicatedCodeProvider.onSearchedClones = () => createDecorationsOnTextEditor(duplicatedCodeProvider, vscode.window.activeTextEditor);

  vscode.commands.registerCommand('duplicatedCode.refreshEntry', () => {
    duplicatedCodeProvider._onDidChangeTreeData.fire();
  });

  vscode.commands.registerCommand('duplicatedCode.openFile', (duplicateCode: DuplicatedCode) => {
    duplicateCode.openFile();
  });

  vscode.commands.registerCommand('duplicatedCode.openTargetFile', async (options: IOpenTargetFileArguments) => {
    const doc = await vscode.workspace.openTextDocument(options.uri);
    const newEditor = await vscode.window.showTextDocument(doc, { preview: options.preview });
    if (options.selection) {
      newEditor.selections = [ new vscode.Selection(options.selection.start, (options.justPlaceCursor ?? false) ? options.selection.start : options.selection.end) ];
      newEditor.revealRange(options.selection, vscode.TextEditorRevealType.InCenter);
    }
  });

  vscode.window.onDidChangeActiveTextEditor((e) => createDecorationsOnTextEditor(duplicatedCodeProvider, e));
}
