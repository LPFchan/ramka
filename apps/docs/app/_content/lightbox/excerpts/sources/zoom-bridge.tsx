import * as Lightbox from '@ramka/react/lightbox';

declare const src: string;
declare const alt: string;

/**
 * ZoomIn/ZoomOut outside Zoom via the active-slide zoom bridge.
 *
 * @docsExcerpt zoom-bridge
 * @docsExcerptTitle Active-zoom bridge
 */
export function ZoomBridgeExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          {/* Toolbar chrome — targets the active slide's Zoom */}
          <Lightbox.ZoomOut />
          <Lightbox.ZoomIn />

          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>
                <Lightbox.Zoom>
                  <Lightbox.Media>
                    <img src={src} alt={alt} />
                  </Lightbox.Media>
                </Lightbox.Zoom>
              </Lightbox.Item>
            </Lightbox.Slide>
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
