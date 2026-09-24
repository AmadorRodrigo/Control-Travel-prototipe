import logging
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode

from app.core.config import settings


logger = logging.getLogger(__name__)


def send_password_reset_email(recipient: str, token: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        logger.error("Password reset email unavailable: SMTP is not configured")
        return

    reset_link = f"{settings.reset_password_url}?{urlencode({'token': token})}"
    message = EmailMessage()
    message["Subject"] = "Control Travel — redefinição de senha"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(
        "Recebemos uma solicitação para redefinir sua senha.\n\n"
        f"Acesse: {reset_link}\n\n"
        f"O link expira em {settings.password_reset_expire_minutes} minutos "
        "e só pode ser usado uma vez.\n"
        "Se você não solicitou esta alteração, ignore esta mensagem."
    )

    try:
        context = ssl.create_default_context()
        smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        kwargs = {"context": context} if settings.smtp_use_ssl else {}
        with smtp_class(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
            **kwargs,
        ) as smtp:
            if not settings.smtp_use_ssl:
                smtp.starttls(context=context)
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError):
        # SMTP exceptions may contain recipient addresses or message contents.
        logger.error(
            "Password reset email delivery failed; check SMTP connectivity and credentials"
        )
