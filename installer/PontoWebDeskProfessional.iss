; Inno Setup — PontoWebDesk Professional (RC2.4.3)
; Gera: dist-installer\Setup.exe
;
; Runtime exclusivamente de: npm run stage:rc2 → dist-installer\PontoWebDesk-Professional\
; Build: scripts\build-professional-installer.bat
;
; === Ativacao Cloud (pac_*) — como o cliente fornece ===
; Mecanismo oficial (NAO usar licenseKey):
;   1) Wizard: pagina "Ativacao Cloud" (URL + token pac_*) → grava
;      %ProgramData%\PontoWebDesk\Config\cloud-activation.pending.json
;      (consumido por professional-install.ps1 → env → SecretsStore; arquivo apagado)
;   2) Silencioso: definir env ANTES do Setup.exe (herdado pelo bootstrap):
;        set RC2_CLOUD_MASTER_URL=https://master.exemplo.com
;        set RC2_ACTIVATION_TOKEN=pac_...
;        Setup.exe /VERYSILENT /NORESTART
;   RC2_ACTIVATION_REQUIRED=true e sempre forçado pelo professional-install.ps1.
;   O token NUNCA e passado em ArgumentList do powershell/node.
;
; Silencioso / log (Inno Setup):
;   Setup.exe /SILENT /NORESTART /LOG="%TEMP%\pwd-professional-setup.log"
;   Setup.exe /VERYSILENT /NORESTART /LOG="..."
; Log da instalacao (Bootstrap + Setup): %ProgramData%\PontoWebDesk\Logs\installer.log
;
; Desinstalacao: ProgramData (banco/secrets/MachineId) e PRESERVADO por padrao.
;   Task "removedata" ou -RemoveProgramData para apagar explicitamente.

#define MyAppName "PontoWebDesk Professional"
#define MyAppPublisher "PontoWebDesk"
#define MyAppURL "https://pontowebdesk.vercel.app"
#define MyAppId "{{B3E8F2A1-9C4D-4E7B-8F21-A1B2C3D4E5F6}}"
#define DataRoot "{commonappdata}\PontoWebDesk"
#define StagingDir AddBackslash(SourcePath) + "..\dist-installer\PontoWebDesk-Professional"
#define StagingManifest StagingDir + "\layout.manifest.json"

#include "rc2-staging-version.inc"

#if !FileExists(StagingManifest)
  #error "Staging RC2 ausente. Execute: npm run stage:rc2 (e npm run verify:rc2) antes do ISCC."
#endif

#if !FileExists(StagingDir + "\Bootstrap\dist\index.js")
  #error "Staging incompleto: Bootstrap\dist\index.js ausente. Execute npm run stage:rc2 e verify:rc2."
#endif

#if !FileExists(StagingDir + "\Bin\serve-frontend.mjs")
  #error "Staging incompleto: Bin\serve-frontend.mjs ausente. Execute npm run stage:rc2 e verify:rc2."
#endif

#if !FileExists(StagingDir + "\Database\bin\postgres.exe")
  #error "Staging incompleto: Database\bin\postgres.exe ausente. Gere o runtime PG 16.8 (RC2_DATABASE_RUNTIME_DIR) antes do stage:rc2."
#endif

#if !FileExists(StagingDir + "\Backend\node\node.exe")
  #error "Staging incompleto: Backend\node\node.exe ausente."
#endif

#if !FileExists(StagingDir + "\Frontend\www\index.html")
  #error "Staging incompleto: Frontend\www\index.html ausente."
#endif

#if !FileExists(AddBackslash(SourcePath) + "scripts\professional-install.ps1")
  #error "installer\scripts\professional-install.ps1 ausente."
#endif

#if !FileExists(AddBackslash(SourcePath) + "assets\pontowebdesk.ico")
  #error "installer\assets\pontowebdesk.ico ausente."
#endif

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={commonpf}\PontoWebDesk
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
AllowNoIcons=yes
PrivilegesRequired=admin
OutputDir=..\dist-installer
OutputBaseFilename=Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupLogging=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\pontowebdesk.ico
SetupIconFile=assets\pontowebdesk.ico
VersionInfoVersion=1.0.0.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion=1.0.0.0
CloseApplications=force
RestartIfNeededByRun=no
LicenseFile=LICENSE-PRODUCT.txt
; SignTool=signtool $p /fd SHA256 /f "$env{PWD_CODESIGN_PFX}" /p "$env{PWD_CODESIGN_PASSWORD}" /tr http://timestamp.digicert.com /td SHA256
; SignedUninstaller=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked
Name: "openbrowser"; Description: "Abrir o sistema no navegador ao concluir"; GroupDescription: "Pos-instalacao:"; Flags: checkedonce

[Dirs]
Name: "{app}"; Permissions: users-modify
Name: "{#DataRoot}"
Name: "{#DataRoot}\Config"
Name: "{#DataRoot}\Logs"
Name: "{#DataRoot}\Storage"
Name: "{#DataRoot}\Backups"
Name: "{#DataRoot}\Database\pgdata"

[Files]
Source: "{#StagingDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "scripts\professional-*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "assets\pontowebdesk.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\codesign.placeholder.txt"; DestDir: "{app}\docs"; DestName: "codesign.placeholder.txt"; Flags: ignoreversion
Source: "LICENSE-PRODUCT.txt"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{code:GetAppUrl}"; IconFilename: "{app}\pontowebdesk.ico"; IconIndex: 0
Name: "{group}\Abrir PontoWebDesk"; Filename: "{code:GetAppUrl}"; IconFilename: "{app}\pontowebdesk.ico"; IconIndex: 0
Name: "{group}\Logs (installer.log)"; Filename: "{#DataRoot}\Logs\installer.log"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\pontowebdesk.ico"; IconIndex: 0
Name: "{commondesktop}\{#MyAppName}"; Filename: "{code:GetAppUrl}"; IconFilename: "{app}\pontowebdesk.ico"; IconIndex: 0; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\professional-install.ps1"" -InstallDir ""{app}"" -ProgramDataDir ""{#DataRoot}"" -LogFile ""{#DataRoot}\Logs\installer.log"" {code:SilentFlags} {code:BrowserFlag}"; \
  StatusMsg: "Configurando PostgreSQL, API, Bootstrap e ativacao..."; \
  Flags: runhidden waituntilterminated; \
  WorkingDir: "{app}"

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\professional-uninstall.ps1"" -InstallDir ""{app}"" -ProgramDataDir ""{#DataRoot}"" -LogFile ""{#DataRoot}\Logs\installer.log"" {code:UninstallDataFlags}"; \
  Flags: runhidden waituntilterminated; RunOnceId: "Rc2ProUninstall"

[Code]
var
  ActivationPage: TInputQueryWizardPage;
  CloudUrlValue: String;
  ActivationTokenValue: String;
  RemoveDataOnUninstall: Boolean;

function GetAppUrl(Param: String): String;
begin
  Result := 'http://127.0.0.1:3010/';
end;

function SilentFlags(Param: String): String;
begin
  if WizardSilent then
    Result := '-Silent'
  else
    Result := '';
end;

function BrowserFlag(Param: String): String;
begin
  if WizardSilent then
    Result := ''
  else if WizardIsTaskSelected('openbrowser') then
    Result := '-OpenBrowser'
  else
    Result := '';
end;

function UninstallDataFlags(Param: String): String;
begin
  { Padrao: preservar ProgramData. Remocao so com confirmacao explicita. }
  if RemoveDataOnUninstall then
    Result := '-RemoveProgramData'
  else
    Result := '';
end;

function WritePendingActivationFile: Boolean;
var
  ConfigDir, PendingPath, Json, UrlEsc, TokEsc: String;
begin
  Result := True;
  CloudUrlValue := Trim(CloudUrlValue);
  ActivationTokenValue := Trim(ActivationTokenValue);
  if (CloudUrlValue = '') and (ActivationTokenValue = '') then
  begin
    { Silencioso com env RC2_* ou retentativa — pending opcional }
    Result := True;
    exit;
  end;

  ConfigDir := ExpandConstant('{#DataRoot}\Config');
  if not DirExists(ConfigDir) then
    ForceDirectories(ConfigDir);

  PendingPath := ConfigDir + '\cloud-activation.pending.json';
  UrlEsc := CloudUrlValue;
  TokEsc := ActivationTokenValue;
  StringChangeEx(UrlEsc, '\', '\\', True);
  StringChangeEx(UrlEsc, '"', '\"', True);
  StringChangeEx(TokEsc, '\', '\\', True);
  StringChangeEx(TokEsc, '"', '\"', True);

  Json := '{' + #13#10 +
    '  "cloudMasterUrl": "' + UrlEsc + '",' + #13#10 +
    '  "cloudActivationToken": "' + TokEsc + '"' + #13#10 +
    '}' + #13#10;

  if not SaveStringToFile(PendingPath, Json, False) then
  begin
    MsgBox('Nao foi possivel gravar cloud-activation.pending.json em ProgramData\Config.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure InitializeWizard;
var
  EnvUrl, EnvToken: String;
begin
  ActivationPage := CreateInputQueryPage(wpSelectTasks,
    'Ativacao Cloud (Professional)',
    'Informe a URL do Master Cloud e o token de ativacao (pac_*).',
    'O token e one-shot e nao autentica por licenseKey. Em modo silencioso, use as variaveis de ambiente RC2_CLOUD_MASTER_URL e RC2_ACTIVATION_TOKEN.');
  ActivationPage.Add('URL do Master Cloud (https://...):', False);
  ActivationPage.Add('Token de ativacao (pac_*):', True);

  EnvUrl := GetEnv('RC2_CLOUD_MASTER_URL');
  EnvToken := GetEnv('RC2_ACTIVATION_TOKEN');
  if EnvUrl <> '' then
    ActivationPage.Values[0] := EnvUrl;
  if EnvToken <> '' then
    ActivationPage.Values[1] := EnvToken;

  RemoveDataOnUninstall := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = ActivationPage.ID then
  begin
    CloudUrlValue := Trim(ActivationPage.Values[0]);
    ActivationTokenValue := Trim(ActivationPage.Values[1]);
    if (ActivationTokenValue <> '') and (Copy(ActivationTokenValue, 1, 4) <> 'pac_') then
    begin
      MsgBox('O token deve comecar com pac_ (credencial de ativacao Professional).', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if (ActivationTokenValue <> '') and (CloudUrlValue = '') then
    begin
      MsgBox('Informe a URL do Master Cloud (https) junto com o token pac_*.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if (CloudUrlValue <> '') and (ActivationTokenValue = '') then
    begin
      MsgBox('Informe o token pac_* junto com a URL do Master Cloud.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    { Ambos vazios: permitido no wizard (env pode preencher); install falhara com ACTIVATION_REQUIRED se nada vier. }
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssInstall) and (not DirExists(ExpandConstant('{#DataRoot}\Logs'))) then
  begin
    ForceDirectories(ExpandConstant('{#DataRoot}\Logs'));
  end;
  if CurStep = ssPostInstall then
  begin
    if not WizardSilent then
    begin
      CloudUrlValue := Trim(ActivationPage.Values[0]);
      ActivationTokenValue := Trim(ActivationPage.Values[1]);
    end
    else
    begin
      { Silencioso: preferir env (nao cmdline) }
      CloudUrlValue := GetEnv('RC2_CLOUD_MASTER_URL');
      ActivationTokenValue := GetEnv('RC2_ACTIVATION_TOKEN');
    end;
    WritePendingActivationFile;
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  RemoveDataOnUninstall := False;
  if UninstallSilent then
  begin
    { Silencioso: preservar ProgramData salvo /REMOVEALLDATA=1 }
    if ExpandConstant('{param:REMOVEALLDATA|0}') = '1' then
      RemoveDataOnUninstall := True;
    exit;
  end;
  if MsgBox(
    'Deseja tambem REMOVER os dados do cliente em ProgramData?' + #13#10 + #13#10 +
    'Isso apaga banco local, secrets, MachineId e autorizacao Cloud.' + #13#10 +
    'Recomendado: Nao (preservar para reinstalacao).' + #13#10 + #13#10 +
    ExpandConstant('{#DataRoot}'),
    mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
  begin
    if MsgBox(
      'CONFIRMACAO: remover permanentemente ProgramData?',
      mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      RemoveDataOnUninstall := True;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and (not UninstallSilent) then
  begin
    if DirExists(ExpandConstant('{#DataRoot}')) then
      MsgBox(
        'ProgramData foi preservado (banco, configuracao e secrets).' + #13#10 +
        'Caminho: ' + ExpandConstant('{#DataRoot}'),
        mbInformation, MB_OK);
  end;
end;

[Messages]
SetupAppTitle=Instalar {#MyAppName}
SetupWindowTitle=Instalar {#MyAppName}
