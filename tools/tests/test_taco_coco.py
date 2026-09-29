from common import transform_bbox_after_crop_resize


def test_bbox_outside_crop():
    box = (40, 0, 280, 240)
    assert transform_bbox_after_crop_resize((0, 0, 10, 10), box, 240) is None
