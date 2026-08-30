#include "ops/DebugOverlay.hpp"

#include "ops/FieldOps.hpp"
#include "util/Logger.hpp"

#include <atomic>
#include <chrono>
#include <fstream>
#include <vector>

#ifdef _WIN32
#define PLAYER_LINUX_NO_FIELD 1
#endif

#ifdef PLAYER_LINUX_WITH_X11
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#endif

namespace player::ops {

namespace {

std::atomic<bool> gShowOverlay{false};

void writeDebugFile(const std::string& text) {
  std::ofstream out("/tmp/player-linux-debug.txt");
  if (out) out << text;
}

void showViaHelper(const std::string& text) {
  writeDebugFile(text);
  util::Logger::i("DEBUG", "overlay pedido — ver /tmp/player-linux-debug.txt");
#ifdef PLAYER_LINUX_NO_FIELD
  (void)text;
#else
  const std::string q = text.substr(0, 1500);
  std::string esc;
  for (char c : q) {
    if (c == '\'') esc += "'\\''";
    else if (c == '\n') esc += "\\n";
    else
      esc += c;
  }
  (void)run("command -v zenity >/dev/null && zenity --info --title='Player-Linux debug' --width=520 --text='" +
                esc + "' || xmessage -center -timeout 30 -file /tmp/player-linux-debug.txt || true",
            40);
#endif
}

#ifdef PLAYER_LINUX_WITH_X11

void drawMultiline(Display* dpy, Window win, GC gc, int x, int y, const std::string& text) {
  int lineY = y;
  std::string line;
  for (char c : text) {
    if (c == '\n') {
      if (!line.empty()) XDrawString(dpy, win, gc, x, lineY, line.c_str(), static_cast<int>(line.size()));
      line.clear();
      lineY += 18;
    } else {
      line.push_back(c);
    }
  }
  if (!line.empty()) XDrawString(dpy, win, gc, x, lineY, line.c_str(), static_cast<int>(line.size()));
}

void x11Loop(const std::function<DebugSnapshot()>& snap, std::atomic<bool>& running) {
  XInitThreads();
  Display* dpy = XOpenDisplay(nullptr);
  if (!dpy) {
    util::Logger::w("DEBUG", "XOpenDisplay falhou — fallback zenity/xmessage");
    while (running.load()) {
      if (takeDebugOverlay()) showViaHelper(formatDebugOverlay(snap ? snap() : DebugSnapshot{}));
      std::this_thread::sleep_for(std::chrono::milliseconds(80));
    }
    return;
  }

  const int screen = DefaultScreen(dpy);
  const int sw = DisplayWidth(dpy, screen);
  const int sh = DisplayHeight(dpy, screen);
  const unsigned long black = BlackPixel(dpy, screen);
  const unsigned long white = WhitePixel(dpy, screen);

  const int hzW = 180;
  const int hzH = 72;
  const int hzX = (sw - hzW) / 2;
  const int hzY = sh - hzH - 24;
  Window hot = XCreateSimpleWindow(dpy, RootWindow(dpy, screen), hzX, hzY, hzW, hzH, 1, white, black);
  XSetWindowAttributes hzAttr{};
  hzAttr.override_redirect = True;
  XChangeWindowAttributes(dpy, hot, CWOverrideRedirect, &hzAttr);
  XSelectInput(dpy, hot, ButtonPressMask | ExposureMask);
  XStoreName(dpy, hot, "player-ok");
  XMapRaised(dpy, hot);

  Window panel = XCreateSimpleWindow(dpy, RootWindow(dpy, screen), 0, 0, static_cast<unsigned>(sw),
                                     static_cast<unsigned>(sh), 0, white, black);
  XSetWindowAttributes pAttr{};
  pAttr.override_redirect = True;
  XChangeWindowAttributes(dpy, panel, CWOverrideRedirect, &pAttr);
  XSelectInput(dpy, panel, ButtonPressMask | ExposureMask | KeyPressMask);

  GC gc = XCreateGC(dpy, hot, 0, nullptr);
  XSetForeground(dpy, gc, white);
  XFontStruct* font = XLoadQueryFont(dpy, "9x15");
  if (font) XSetFont(dpy, gc, font->fid);

  TapState taps;
  bool panelUp = false;
  std::string panelText;
  auto raiseHot = [&] { XRaiseWindow(dpy, hot); XFlush(dpy); };
  auto paintHot = [&] {
    XClearWindow(dpy, hot);
    XDrawString(dpy, hot, gc, 62, 42, "OK", 2);
  };
  auto paintPanel = [&] {
    XClearWindow(dpy, panel);
    drawMultiline(dpy, panel, gc, 36, 48, panelText);
  };
  auto showPanel = [&] {
    panelText = formatDebugOverlay(snap ? snap() : DebugSnapshot{});
    writeDebugFile(panelText);
    XMapRaised(dpy, panel);
    panelUp = true;
    paintPanel();
    requestKioskEscape();
    releaseKiosk();
    util::Logger::i("DEBUG", "overlay X11 visivel");
  };
  auto hidePanel = [&] {
    XUnmapWindow(dpy, panel);
    panelUp = false;
    raiseHot();
  };

  paintHot();
  raiseHot();
  auto lastRaise = std::chrono::steady_clock::now();

  while (running.load()) {
    if (takeDebugOverlay() && !panelUp) showPanel();

    const auto now = std::chrono::steady_clock::now();
    if (now - lastRaise > std::chrono::seconds(2)) {
      if (!panelUp) raiseHot();
      lastRaise = now;
    }

    while (XPending(dpy) > 0) {
      XEvent ev;
      XNextEvent(dpy, &ev);
      if (ev.type == Expose) {
        if (ev.xexpose.window == hot && !panelUp) paintHot();
        if (ev.xexpose.window == panel && panelUp) paintPanel();
      }
      if (ev.type == ButtonPress) {
        if (panelUp && ev.xbutton.window == panel) {
          hidePanel();
          continue;
        }
        if (!panelUp && ev.xbutton.window == hot) {
          const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                              std::chrono::steady_clock::now().time_since_epoch())
                              .count();
          if (noteDebugTap(taps, ms)) showPanel();
        }
      }
      if (ev.type == KeyPress && panelUp) hidePanel();
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(40));
  }

  XUnmapWindow(dpy, panel);
  XUnmapWindow(dpy, hot);
  if (font) XFreeFont(dpy, font);
  XFreeGC(dpy, gc);
  XDestroyWindow(dpy, panel);
  XDestroyWindow(dpy, hot);
  XCloseDisplay(dpy);
}

#endif

}  // namespace

void requestDebugOverlay() { gShowOverlay.store(true); }

bool takeDebugOverlay() { return gShowOverlay.exchange(false); }

void DebugUi::start(std::function<DebugSnapshot()> snap) {
  if (running_.exchange(true)) return;
  snap_ = std::move(snap);
  th_ = std::thread([this] { loop(); });
}

void DebugUi::stop() {
  if (!running_.exchange(false)) return;
  if (th_.joinable()) th_.join();
}

void DebugUi::loop() {
#ifdef PLAYER_LINUX_WITH_X11
  x11Loop(snap_, running_);
#else
  util::Logger::i("DEBUG", "sem libX11 — overlay via SIGUSR1 + zenity/xmessage se DISPLAY");
  while (running_.load()) {
    if (takeDebugOverlay()) {
      const std::string text = formatDebugOverlay(snap_ ? snap_() : DebugSnapshot{});
      showViaHelper(text);
      requestKioskEscape();
      releaseKiosk();
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(80));
  }
#endif
}

}  // namespace player::ops
