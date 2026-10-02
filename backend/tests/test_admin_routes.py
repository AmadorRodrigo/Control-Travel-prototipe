import pytest

from app.core.security import create_access_token


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("GET", "/api/viagens", None),
        (
            "POST",
            "/api/viagens",
            {
                "titulo": "Viagem de teste",
                "origem": "Brasília",
                "destino": "Goiânia",
                "data_partida": "2026-12-01T10:00:00Z",
                "capacidade_andar_inferior": 2,
            },
        ),
        ("PUT", "/api/viagens/1", {"titulo": "Viagem alterada"}),
        ("GET", "/api/viagens/1/assentos", None),
        (
            "POST",
            "/api/viagens/1/assentos/reservar",
            {"passageiro_id": 1, "numero": 1, "andar": "inferior"},
        ),
        ("DELETE", "/api/viagens/1/assentos/1/reserva", None),
        ("GET", "/api/passageiros", None),
        (
            "POST",
            "/api/passageiros",
            {
                "nome": "Passageiro Teste",
                "documento": "DOC12345",
                "data_nascimento": "1990-01-01",
                "telefone": "+5511999999999",
                "contato_emergencia": "Contato Teste",
            },
        ),
        ("GET", "/api/passageiros/1", None),
        ("PUT", "/api/passageiros/1", {"nome": "Passageiro Alterado"}),
        ("DELETE", "/api/passageiros/1", None),
    ],
)
def test_regular_user_cannot_manage_trips_seats_or_passengers(
    client, user, method, path, payload
):
    token = create_access_token(
        subject=str(user.id),
        username=user.username,
        token_version=user.token_version,
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = client.request(method, path, json=payload, headers=headers)

    assert response.status_code == 403
