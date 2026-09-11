from tests.conftest import csrf_headers_from_response, register_user


def test_update_user_timezone(client):
    registered = register_user(client, email="timezone@example.com")
    headers = csrf_headers_from_response(registered)

    updated = client.patch(
        "/me",
        json={"timezone": "Asia/Tehran"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["timezone"] == "Asia/Tehran"

    invalid = client.patch(
        "/me",
        json={"timezone": "Not/A_Timezone"},
        headers=headers,
    )
    assert invalid.status_code == 422
