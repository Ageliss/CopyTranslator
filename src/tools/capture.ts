import { desktopCapturer, screen, ipcRenderer, nativeImage } from "electron";
import { MessageType } from "./enums";
//注意，这一个函数一定要在渲染进程里调用
export interface CaptureType {
  x: number;
  y: number;
  width: number;
  height: number;
  image?: string;
}

function getDisplay() {
  const point = screen.getCursorScreenPoint();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { id, bounds, workArea, scaleFactor } = screen.getDisplayNearestPoint(
    point
  );
  // win32 darwin linux平台分别处理
  const scale =
    process.platform === "darwin"
      ? 1
      : scaleFactor / primaryDisplay.scaleFactor;
  const display = process.platform === "linux" ? workArea : bounds;
  return {
    id,
    scaleFactor,
    x: display.x * (scale >= 1 ? scale : 1),
    y: display.y * (scale >= 1 ? scale : 1),
    width: display.width * scale,
    height: display.height * scale
  };
}

function getSource(
  display: ReturnType<typeof getDisplay>
): Promise<CaptureType> {
  return new Promise((resolve, reject) => {
    desktopCapturer.getSources(
      {
        types: ["screen"],
        thumbnailSize: {
          width: display.width,
          height: display.width
        }
      },
      (error, sources) => {
        if (error) return reject(error);
        const index = screen
          .getAllDisplays()
          .findIndex(({ id }) => id === display.id);
        if (index === -1)
          reject(new Error(`Not find display ${display.id} source`));
        resolve({
          x: 0,
          y: 0,
          width: display.width,
          height: display.height,
          image: sources[index].thumbnail.toDataURL()
        });
      }
    );
  });
}

export async function capture(options: CaptureType) {
  try {
    const source: CaptureType = await getSource(getDisplay());
    // 把数据传递到主进程
    const thumbnail = <string>source.image;
    let img = new Image();
    let canvas = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D = <CanvasRenderingContext2D>(
      canvas.getContext("2d")
    );
    img.src = thumbnail;
    img.addEventListener("load", () => {
      canvas.width = options.width;
      canvas.height = options.height;
      ctx.drawImage(
        img,
        options.x,
        options.y,
        options.width,
        options.height,
        0,
        0,
        options.width,
        options.height
      );
      options.image = canvas.toDataURL();
      ipcRenderer.send(MessageType.CaptureScreen.toString(), options);
    });
  } catch (e) {
    console.log(e);
  }
}
