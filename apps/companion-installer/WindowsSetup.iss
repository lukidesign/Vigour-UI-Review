; Build with /DSourceDir=<sealed payload> /DRepoDir=<source root> /DAppVersion=<version>.
; The bundled Node CLI verifies the payload and owns the HKCU registration.
#ifndef SourceDir
  #error SourceDir is required
#endif
#ifndef RepoDir
  #error RepoDir is required
#endif
#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef ExtensionId
  #define ExtensionId "dmkfgmpbomjjhalgnfhcpalobdnklchh"
#endif

[Setup]
AppId={{8E0B16A2-757B-4B9D-8457-AF894895E22A}
AppName=Vigour UI Review Companion
AppVersion={#AppVersion}
AppPublisher=LukiDesign
DefaultDirName={localappdata}\Programs\Vigour UI Review Setup
DisableDirPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0.22000
Compression=lzma2
SolidCompression=yes
OutputBaseFilename=Vigour-UI-Review-{#AppVersion}-windows-x64-dev-setup
UninstallDisplayName=Vigour UI Review Companion
WizardStyle=modern

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}\companion"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#SourceDir}\runtime\node.exe"; DestDir: "{app}\installer"; DestName: "node.exe"; Flags: ignoreversion
Source: "{#RepoDir}\apps\companion-installer\windows-cli.mjs"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#RepoDir}\apps\companion-installer\windows-core.mjs"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#RepoDir}\apps\companion-installer\payload.mjs"; DestDir: "{app}\installer"; Flags: ignoreversion

[Code]
var
  ActionPage: TInputOptionWizardPage;
  IdPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ActionPage := CreateInputOptionPage(wpWelcome, '本地配套程序', '选择操作',
    '安装完成后，在 Chrome 扩展中点击“打开工作台”。', True, False);
  ActionPage.Add('安装或更新');
  ActionPage.Add('修复 Chrome 配对');
  ActionPage.Add('回退上一安装');
  ActionPage.SelectedValueIndex := 0;
  IdPage := CreateInputQueryPage(ActionPage.ID, 'Chrome 扩展', '确认扩展 ID',
    '商店版本已预填。测试未打包扩展时，请从 chrome://extensions 复制其实际 ID。');
  IdPage.Add('Chrome 扩展 ID', False);
  IdPage.Values[0] := '{#ExtensionId}';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Value: String;
  Index: Integer;
begin
  Result := True;
  if CurPageID <> IdPage.ID then Exit;
  Value := IdPage.Values[0];
  if Length(Value) <> 32 then Result := False;
  if Result then
    for Index := 1 to Length(Value) do
      if (Value[Index] < 'a') or (Value[Index] > 'p') then Result := False;
  if not Result then MsgBox('扩展 ID 应为 32 个 a–p 小写字母。', mbError, MB_OK);
end;

function SelectedAction: String;
begin
  if ActionPage.SelectedValueIndex = 1 then Result := 'repair'
  else if ActionPage.SelectedValueIndex = 2 then Result := 'rollback'
  else Result := 'install';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
  Messages: TArrayOfString;
begin
  if CurStep <> ssPostInstall then Exit;
  if (not Exec(ExpandConstant('{app}\installer\node.exe'),
    '"' + ExpandConstant('{app}\installer\windows-cli.mjs') + '" ' + SelectedAction + ' ' + IdPage.Values[0],
    ExpandConstant('{app}\installer'), SW_HIDE, ewWaitUntilTerminated, Code)) or (Code <> 0) then
  begin
    if LoadStringsFromFile(ExpandConstant('{app}\installer\result.txt'), Messages) and (GetArrayLength(Messages) > 0) then
      RaiseException(Messages[0]);
    RaiseException('无法完成本地配套程序安装。');
  end;
end;

function InitializeUninstall: Boolean;
var
  Code: Integer;
  Messages: TArrayOfString;
begin
  Result := Exec(ExpandConstant('{app}\installer\node.exe'),
    '"' + ExpandConstant('{app}\installer\windows-cli.mjs') + '" uninstall',
    ExpandConstant('{app}\installer'), SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
  if not Result then
  begin
    if LoadStringsFromFile(ExpandConstant('{app}\installer\result.txt'), Messages) and (GetArrayLength(Messages) > 0) then
      MsgBox(Messages[0], mbError, MB_OK)
    else MsgBox('卸载未完成，项目数据保持不变。', mbError, MB_OK);
  end;
end;
