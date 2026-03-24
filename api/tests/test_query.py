import pytest
from pydantic import ValidationError

from routes.query import QueryRequest


def test_valid_query():
    req = QueryRequest(kql="SecurityAlert | take 10", dashboard_id="550e8400-e29b-41d4-a716-446655440000")
    assert req.kql == "SecurityAlert | take 10"


def test_empty_query_rejected():
    with pytest.raises(ValidationError):
        QueryRequest(kql="", dashboard_id="550e8400-e29b-41d4-a716-446655440000")


def test_whitespace_only_query_rejected():
    with pytest.raises(ValidationError):
        QueryRequest(kql="   ", dashboard_id="550e8400-e29b-41d4-a716-446655440000")


def test_query_too_long_rejected():
    with pytest.raises(ValidationError):
        QueryRequest(kql="x" * 10_001, dashboard_id="550e8400-e29b-41d4-a716-446655440000")


def test_externaldata_blocked():
    with pytest.raises(ValidationError):
        QueryRequest(
            kql="externaldata(col1:string) ['http://evil.com/data.csv']",
            dashboard_id="550e8400-e29b-41d4-a716-446655440000",
        )


def test_http_request_blocked():
    with pytest.raises(ValidationError):
        QueryRequest(
            kql="print http_request('http://evil.com')",
            dashboard_id="550e8400-e29b-41d4-a716-446655440000",
        )


def test_blocked_patterns_case_insensitive():
    with pytest.raises(ValidationError):
        QueryRequest(
            kql="EXTERNALDATA(col1:string) ['http://evil.com']",
            dashboard_id="550e8400-e29b-41d4-a716-446655440000",
        )
