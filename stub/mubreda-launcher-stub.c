#define WIN32_LEAN_AND_MEAN
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>

/* Tiny stub: lives next to Main.exe and starts the real Electron app from
 * .\MuBreda-Launcher\MuBreda-Launcher-App.exe
 */

static void join_path(wchar_t *out, size_t out_chars, const wchar_t *a, const wchar_t *b) {
  lstrcpynW(out, a, (int)out_chars);
  size_t len = lstrlenW(out);
  if (len > 0 && out[len - 1] != L'\\') {
    if (len + 1 < out_chars) {
      out[len++] = L'\\';
      out[len] = L'\0';
    }
  }
  lstrcpynW(out + lstrlenW(out), b, (int)(out_chars - lstrlenW(out)));
}

int WINAPI WinMain(HINSTANCE inst, HINSTANCE prev, LPSTR cmd, int show) {
  (void)inst;
  (void)prev;
  (void)cmd;
  (void)show;

  wchar_t module[MAX_PATH];
  DWORD n = GetModuleFileNameW(NULL, module, MAX_PATH);
  if (n == 0 || n >= MAX_PATH) {
    MessageBoxW(NULL, L"No se pudo resolver la ruta del launcher.", L"MU Breda Launcher", MB_OK | MB_ICONERROR);
    return 1;
  }

  wchar_t *slash = wcsrchr(module, L'\\');
  if (!slash) {
    MessageBoxW(NULL, L"Ruta de launcher invalida.", L"MU Breda Launcher", MB_OK | MB_ICONERROR);
    return 1;
  }
  *slash = L'\0';

  wchar_t target[MAX_PATH];
  join_path(target, MAX_PATH, module, L"MuBreda-Launcher\\MuBreda-Launcher-App.exe");

  if (GetFileAttributesW(target) == INVALID_FILE_ATTRIBUTES) {
    MessageBoxW(
      NULL,
      L"No se encontro MuBreda-Launcher\\MuBreda-Launcher-App.exe\n\n"
      L"Copia la carpeta MuBreda-Launcher junto a este exe y a Main.exe.",
      L"MU Breda Launcher",
      MB_OK | MB_ICONERROR);
    return 2;
  }

  wchar_t workdir[MAX_PATH];
  join_path(workdir, MAX_PATH, module, L"MuBreda-Launcher");

  SHELLEXECUTEINFOW sei;
  ZeroMemory(&sei, sizeof(sei));
  sei.cbSize = sizeof(sei);
  sei.fMask = SEE_MASK_NOCLOSEPROCESS;
  sei.lpVerb = L"open";
  sei.lpFile = target;
  sei.lpDirectory = workdir;
  sei.nShow = SW_SHOWNORMAL;

  if (!ShellExecuteExW(&sei)) {
    MessageBoxW(NULL, L"No se pudo iniciar MU Breda Launcher.", L"MU Breda Launcher", MB_OK | MB_ICONERROR);
    return 3;
  }

  if (sei.hProcess) CloseHandle(sei.hProcess);
  return 0;
}
