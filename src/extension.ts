import * as vscode from 'vscode';

import { DuplicatedCode } from './duplicated-code';
import { DuplicatedCodeProvider } from './duplicated-code.provider';
import { IClone } from 'jscpd';

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
      const side = ((clone: IClone) => {
        if (clone.duplicationA.sourceId === fileName) { return 'a'; }
        else if (clone.duplicationB.sourceId === fileName) { return 'b'; }
        else { return null; }
      })(c);
      return { ...c, side };
    })
    .filter(c => c.side);
  
  textEditor?.setDecorations(duplicatedCodeDecorationType, clonesInThisFile.map(c => {
    const duplication = { a: c.duplicationA, b: c.duplicationB }[c.side!];
    const duplicationOtherSide = { a: c.duplicationB, b: c.duplicationA }[c.side!];
    return { 
      range: new vscode.Range(
        duplication!.start.line - 1, (duplication!.start.column ?? 1) - 1, 
        duplication!.end.line - 1, (duplication!.end.column ?? 1) - 1),
        hoverMessage: `Duplicated code found in ${duplicationOtherSide?.sourceId}:${duplicationOtherSide?.start.line}:${duplicationOtherSide?.start.column ?? 1}:\n`
          + '```\n' + duplicationOtherSide?.fragment + '\n```', 
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

  vscode.window.onDidChangeActiveTextEditor((e) => createDecorationsOnTextEditor(duplicatedCodeProvider, e));
}
