const ASSET_BASE =
  "https://ust-css-apply.vercel.app/assets/css-apply-static-images/assets/";

/** Campaign-only layout. The caller must escape the title and render trusted body HTML. */
export function wrapCampaignEmail(
  title: string,
  innerHtml: string,
  logo: "css" | "cssapply" = "cssapply",
): string {
  // Select from constants only; never accept an asset URL from campaign content.
  const isCss = logo === "css";
  const logoPath = isCss
    ? "logos/Logo_CSS_Watermark.png"
    : "logos/Logo_CSS_Apply_Email.png";
  const logoWidth = isCss ? 100 : 126;
  const logoHeight = isCss ? 100 : 35;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    .button { display: inline-block; background-color: #044FAF; color: #FFFFFF; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; word-wrap: break-word; }
    .accent-box { background-color: #E8F2FF; color: #134687; padding: 16px; border-radius: 6px; }
    @media only screen and (max-width: 600px) {
      .campaign-outer { padding: 12px 8px !important; }
      .campaign-header { padding-left: 20px !important; padding-right: 20px !important; }
      .campaign-body, .campaign-footer { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #F3F3FD; color: #134687; font-family: Inter, Arial, sans-serif; -webkit-text-size-adjust: 100%;">
  <!-- The solid bgcolor remains readable when a mail client blocks background images. -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F3F3FD" background="${ASSET_BASE}pictures/background_email.png" style="width: 100%; border-collapse: collapse; table-layout: fixed; background-color: #F3F3FD; background-image: url('${ASSET_BASE}pictures/background_email.png'); background-repeat: repeat; background-position: center top; background-size: 800px 1600px;">
    <tr>
      <td class="campaign-outer" align="center" style="padding: 24px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse; table-layout: fixed; background-color: #FFFFFF;">
          <tr>
            <td class="campaign-header" align="center" style="padding: ${isCss ? 8 : 24}px 32px 16px; overflow-wrap: anywhere; word-wrap: break-word; word-break: break-word;">
              <img src="${ASSET_BASE}${logoPath}" width="${logoWidth}" height="${logoHeight}" alt="${isCss ? "CSS Logo" : "CSSApply Logo"}" style="display: block; width: ${logoWidth}px; height: ${logoHeight}px; max-width: 100%; margin: 0 auto; border: 0;">
              <h1 style="margin: ${isCss ? 0 : 12}px 0 0; color: #134687; font-family: Poppins, Inter, Arial, sans-serif; font-size: 24px; line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; word-wrap: break-word;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td class="campaign-body" style="padding: 0 32px 24px; background-color: #FFFFFF; color: #134687; font-size: 16px; line-height: 1.65; overflow-wrap: anywhere; word-wrap: break-word; word-break: break-word;">
${innerHtml}
            </td>
          </tr>
          <tr>
            <td class="campaign-footer" style="padding: 16px 32px; background-color: #E8F2FF; color: #134687; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; word-wrap: break-word; word-break: break-word;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                <tr>
                  <td valign="middle" style="padding: 0 12px 0 0; overflow-wrap: anywhere; word-wrap: break-word; word-break: break-word;">
                    UST Computer Science Society
                    <table class="campaign-socials" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 3px; max-width: 100%; border-collapse: collapse;">
                      <tr>
                        <td valign="middle" style="padding: 0 8px 0 0; font-size: 12px; line-height: 1.6;"><a href="mailto:css.cics@ust.edu.ph" style="color: #044FAF; text-decoration: underline; overflow-wrap: anywhere; word-wrap: break-word;">css.cics@ust.edu.ph</a></td>
                        <td valign="middle" style="padding: 0 4px 0 0;"><a href="https://www.facebook.com/ustcss" target="_blank" rel="noopener noreferrer" aria-label="UST CSS on Facebook" title="Facebook" style="display: block; padding: 2px; text-decoration: none;"><img src="${ASSET_BASE}pictures/facebook_email.png" width="20" height="20" alt="Facebook" style="display: block; width: 20px; height: 20px; border: 0;"></a></td>
                        <td valign="middle" style="padding: 0;"><a href="https://www.instagram.com/ustcss" target="_blank" rel="noopener noreferrer" aria-label="UST CSS on Instagram" title="Instagram" style="display: block; padding: 2px; text-decoration: none;"><img src="${ASSET_BASE}pictures/instagram_email.png" width="20" height="20" alt="Instagram" style="display: block; width: 20px; height: 20px; border: 0;"></a></td>
                      </tr>
                    </table>
                  </td>
                  <td width="44" align="right" valign="middle" style="width: 44px; padding: 0;">
                    <img src="${ASSET_BASE}pictures/CSAR_Excited_Email.png" width="44" height="46" alt="" role="presentation" style="display: block; width: 44px; height: 46px; max-width: 100%; border: 0;">
                  </td>
                </tr>
                <tr>
                  <td class="campaign-rso" colspan="2" style="padding: 6px 0 0; color: #4A6384; font-size: 11px; line-height: 1.5;">RSO Control No.: <span style="white-space: nowrap;">RSO-D-26-27-CICS02</span></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
