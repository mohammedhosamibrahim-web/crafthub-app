; CraftHub — Windows installer (NSIS 3)
;
; Produces a standalone CraftHub-Setup.exe that installs the native launcher,
; registers Start Menu + Desktop shortcuts and an uninstaller.
;
; Build:
;   makensis -DAPP_EXE=CraftHub.exe -DOUT=CraftHub-Setup.exe installer.nsi

Unicode true

!ifndef APP_EXE
  !define APP_EXE "CraftHub.exe"
!endif
!ifndef OUT
  !define OUT "CraftHub-Setup.exe"
!endif

!define APP_NAME     "CraftHub"
!define APP_VERSION  "1.0.0"
!define APP_PUBLISHER "CraftHub"
!define APP_URL      "https://webapp.pages.dev/"
!define UNINST_KEY   "Software\Microsoft\Windows\CurrentVersion\Uninstall\CraftHub"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName"     "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "FileVersion"     "${APP_VERSION}.0"
VIAddVersionKey "ProductVersion"  "${APP_VERSION}.0"
VIAddVersionKey "CompanyName"     "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright"  "${APP_PUBLISHER}"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "crafthub.ico"
!define MUI_UNICON "crafthub.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

Section "CraftHub" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "/oname=${APP_EXE}" "${APP_EXE}"
  File "crafthub.ico"

  ; Start Menu + Desktop shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\crafthub.ico" 0
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\crafthub.ico" 0

  WriteRegStr HKCU "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName"     "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher"       "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout"    "${APP_URL}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon"     "$INSTDIR\crafthub.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\crafthub.ico"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP_NAME}"
SectionEnd
