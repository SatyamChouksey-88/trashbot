from common import centre_crop_box, transform_bbox_after_crop_resize


def test_crop_box():
    l, t, r, b = centre_crop_box(320, 240, 240)
    assert l == 40
    assert t == 0
    assert r - l == 240


def test_bbox_inside():
    box = centre_crop_box(320, 240, 240)
    out = transform_bbox_after_crop_resize((50, 50, 40, 40), box, 240)
    assert out is not None


def test_bbox_tiny_dropped():
    box = centre_crop_box(320, 240, 240)
    assert transform_bbox_after_crop_resize((0, 0, 2, 2), box, 240) is None
